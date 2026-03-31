import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateDoc, doc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Custom hook that encapsulates the shared approval/rejection logic
 * used across admin and company-admin pages for leaves, claims, etc.
 *
 * It handles:
 * - Updating the Firestore document status (approved / rejected)
 * - Recording who performed the action and when
 * - Storing the rejection reason or admin comments
 * - Creating a notification document for the affected user
 * - Managing the loading state throughout the process
 *
 * @param {string} collectionName - The Firestore collection to operate on (e.g. 'leaves', 'claims').
 * @returns {{ handleApproval: Function, actionLoading: boolean }}
 *
 * @example
 * const { handleApproval, actionLoading } = useApprovalHandler('claims');
 *
 * // Inside a submit handler:
 * const result = await handleApproval(
 *   selectedClaim.id,
 *   'approve',
 *   'Looks good, approved.',
 *   { processedAmount: selectedClaim.amount }
 * );
 *
 * if (result.success) {
 *   // refresh list, show toast, etc.
 * } else {
 *   // display result.error
 * }
 */
export const useApprovalHandler = (collectionName) => {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Approve or reject a document and create the corresponding notification.
   *
   * @param {string}  itemId      - The Firestore document ID to update.
   * @param {'approve'|'reject'} actionType - The action being performed.
   * @param {string}  reason      - Rejection reason or admin comments.
   * @param {Object}  [extraData] - Additional fields to merge into the document update
   *                                 (e.g. processedAmount for claims, leave balance adjustments).
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  const handleApproval = async (itemId, actionType, reason = '', extraData = {}) => {
    if (!itemId) {
      console.error(`useApprovalHandler: No itemId provided for ${collectionName}`);
      return { success: false, error: 'No item ID provided' };
    }

    if (!user) {
      console.error('useApprovalHandler: No authenticated user');
      return { success: false, error: 'User not authenticated' };
    }

    setActionLoading(true);

    try {
      const isApprove = actionType === 'approve';
      const statusKey = isApprove ? 'approved' : 'rejected';
      const adminName = `${user.firstName} ${user.lastName}`;

      // ---------------------------------------------------------------
      // 1. Build the update payload
      // ---------------------------------------------------------------
      const updateData = {
        status: statusKey,
        [`${statusKey}By`]: adminName,
        [`${statusKey}ById`]: user.uid,
        [`${statusKey}Date`]: serverTimestamp(),
        // Attach reason / comments depending on the action
        ...(isApprove && { adminComments: reason || `Approved by ${adminName}` }),
        ...(!isApprove && reason && { rejectionReason: reason }),
        // Merge any caller-supplied extra fields (e.g. processedAmount)
        ...extraData,
      };

      console.log(`useApprovalHandler: Updating ${collectionName}/${itemId}`, updateData);

      // ---------------------------------------------------------------
      // 2. Persist the update to Firestore
      // ---------------------------------------------------------------
      await updateDoc(doc(db, collectionName, itemId), updateData);
      console.log(`useApprovalHandler: ${collectionName}/${itemId} ${statusKey} successfully`);

      // ---------------------------------------------------------------
      // 3. Create a notification for the item owner
      // ---------------------------------------------------------------
      // The notification document requires a userId. The caller can pass
      // it via extraData.userId; otherwise we read it from extraData or
      // fall back so the hook remains flexible.
      const targetUserId = extraData._notifyUserId || extraData.userId;

      if (targetUserId) {
        /** @type {import('firebase/firestore').DocumentData} */
        const notification = {
          userId: targetUserId,
          type: `${collectionName.replace(/s$/, '')}_update`, // e.g. 'claim_update', 'leave_update'
          title: `${capitalize(collectionName.replace(/s$/, ''))} ${isApprove ? 'Approved' : 'Rejected'}`,
          message: isApprove
            ? `Your ${collectionName.replace(/s$/, '')} request has been approved by ${adminName}`
            : `Your ${collectionName.replace(/s$/, '')} request has been rejected by ${adminName}.${reason ? ' Reason: ' + reason : ''}`,
          priority: 'high',
          read: false,
          createdAt: serverTimestamp(),
          relatedData: {
            [`${collectionName.replace(/s$/, '')}Id`]: itemId,
            approvedBy: adminName,
            status: statusKey,
            ...(reason && { reason }),
            // Forward any extra relatedData the caller provided
            ...(extraData._notificationRelatedData || {}),
          },
        };

        // Remove internal helper keys so they don't pollute the notification doc
        delete notification.relatedData._notificationRelatedData;

        await addDoc(collection(db, 'notifications'), notification);
        console.log(`useApprovalHandler: Notification created for user ${targetUserId}`);
      } else {
        console.warn(
          'useApprovalHandler: No target userId provided via extraData._notifyUserId or extraData.userId -- skipping notification creation'
        );
      }

      setActionLoading(false);
      return { success: true };
    } catch (error) {
      console.error(`useApprovalHandler: Error processing ${actionType} for ${collectionName}/${itemId}:`, error);
      setActionLoading(false);
      return { success: false, error: error.message };
    }
  };

  return { handleApproval, actionLoading };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default useApprovalHandler;
