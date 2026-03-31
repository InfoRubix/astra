/**
 * Audit Logging Service
 *
 * Centralizes audit trail recording for sensitive operations such as
 * leave approvals, claim processing, attendance modifications, etc.
 *
 * All entries are stored in the 'auditLogs' Firestore collection.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

// ---------------------------------------------------------------------------
// Predefined audit action constants
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  ATTENDANCE_MODIFIED: 'ATTENDANCE_MODIFIED',
  USER_CREATED: 'USER_CREATED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  CHECKOUT_PROCESSED: 'CHECKOUT_PROCESSED'
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the currently authenticated user's basic info, or sensible
 * defaults when no user is signed in (e.g. during server-side cron jobs).
 */
function getCurrentUserInfo() {
  const user = auth.currentUser;
  if (user) {
    return {
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown'
    };
  }
  return {
    userId: 'system',
    userName: 'System'
  };
}

/**
 * Return the browser's userAgent string, or an empty string outside a
 * browser context.
 */
function getUserAgent() {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an audit entry to the 'auditLogs' Firestore collection.
 *
 * @param {string} action   - One of the AUDIT_ACTIONS constants (or any
 *                             descriptive string).
 * @param {Object} details  - Arbitrary context for this event.  For example:
 *                             { leaveId, reason, previousStatus, newStatus }
 * @returns {Promise<string>} The ID of the newly created audit log document.
 */
export async function logAudit(action, details = {}) {
  try {
    const userInfo = getCurrentUserInfo();

    const auditEntry = {
      action,
      details,
      userId: userInfo.userId,
      userName: userInfo.userName,
      timestamp: serverTimestamp(),
      userAgent: getUserAgent(),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'auditLogs'), auditEntry);
    return docRef.id;
  } catch (error) {
    // Audit logging should never break the calling feature, so we only
    // warn instead of re-throwing.
    console.error('Failed to write audit log:', error);
    return null;
  }
}

/**
 * Query audit logs from Firestore.
 *
 * @param {Object} filters
 * @param {string}  [filters.userId]    - Filter by the user who performed the action.
 * @param {string}  [filters.action]    - Filter by action type.
 * @param {Date}    [filters.startDate] - Only include entries on or after this date.
 * @param {Date}    [filters.endDate]   - Only include entries on or before this date.
 * @param {number}  [filters.limit]     - Maximum number of entries to return (default 50).
 * @returns {Promise<Object[]>} Array of audit log entries sorted by timestamp descending.
 */
export async function getAuditLogs(filters = {}) {
  try {
    const queryConstraints = [];

    if (filters.userId) {
      queryConstraints.push(where('userId', '==', filters.userId));
    }

    if (filters.action) {
      queryConstraints.push(where('action', '==', filters.action));
    }

    if (filters.startDate) {
      queryConstraints.push(where('timestamp', '>=', filters.startDate));
    }

    if (filters.endDate) {
      queryConstraints.push(where('timestamp', '<=', filters.endDate));
    }

    // Always sort newest first
    queryConstraints.push(orderBy('timestamp', 'desc'));

    const maxResults = filters.limit || 50;
    queryConstraints.push(limit(maxResults));

    const q = query(collection(db, 'auditLogs'), ...queryConstraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Failed to query audit logs:', error);
    throw error;
  }
}
