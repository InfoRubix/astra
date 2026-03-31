import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format, differenceInMinutes, isAfter, isBefore } from 'date-fns';

/**
 * Forgotten Check-out Request Service
 * Handles manual requests from employees for forgotten check-outs
 */
export const forgottenCheckoutService = {

  /**
   * Submit a forgotten check-out request
   */
  async submitForgottenCheckoutRequest(requestData) {
    try {
      const {
        userId,
        userName,
        userEmail,
        company,
        attendanceId,
        date,
        checkInTime,
        requestedCheckOutTime,
        reason,
        description
      } = requestData;

      // Validate the requested check-out time
      const validation = this.validateCheckoutTime(checkInTime, requestedCheckOutTime, date);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Create the request
      const request = {
        userId,
        userName,
        userEmail,
        company,
        attendanceId,
        date,
        checkInTime,
        requestedCheckOutTime,
        reason, // 'forgot', 'emergency', 'system_error', 'other'
        description: description || '',
        status: 'pending', // 'pending', 'approved', 'rejected'
        submittedAt: serverTimestamp(),
        
        // Calculate working hours for reference
        calculatedWorkingHours: this.calculateWorkingHours(checkInTime, requestedCheckOutTime),
        
        // System validation info
        validation: {
          minimumHours: validation.minimumHours,
          maximumHours: validation.maximumHours,
          isReasonable: validation.isReasonable,
          warningMessage: validation.warningMessage
        },
        
        // Admin fields (to be filled when processed)
        processedAt: null,
        processedBy: null,
        adminComments: '',
        rejectionReason: ''
      };

      const docRef = await addDoc(collection(db, 'forgottenCheckoutRequests'), request);
      
      // Create notification for admins
      await this.notifyAdmins(company, {
        type: 'forgotten_checkout_request',
        title: 'New Forgotten Check-out Request',
        message: `${userName} has requested to update their check-out time for ${(() => {
          try {
            const dateObj = date?.toDate ? date.toDate() : new Date(date);
            return format(dateObj, 'dd/MM/yyyy');
          } catch (error) {
            return 'Unknown date';
          }
        })()}`,
        requestId: docRef.id,
        userId,
        userName,
        date
      });

      console.log('✅ Forgotten check-out request submitted:', docRef.id);
      return {
        success: true,
        requestId: docRef.id,
        message: 'Your forgotten check-out request has been submitted and is pending admin approval.'
      };

    } catch (error) {
      console.error('Error submitting forgotten check-out request:', error);
      throw error;
    }
  },

  /**
   * Get forgotten check-out requests for admin review
   */
  async getForgottenCheckoutRequests(company, status = 'all') {
    try {
      console.log('🔍 Querying forgottenCheckoutRequests with:', { company, status });
      console.log('🔍 Company type:', typeof company, 'Company value:', JSON.stringify(company));
      
      // First, let's get ALL documents to see what exists
      const allDocsQuery = query(collection(db, 'forgottenCheckoutRequests'));
      const allDocsSnapshot = await getDocs(allDocsQuery);
      console.log('📊 ALL DOCUMENTS in collection:', allDocsSnapshot.docs.length);
      
      allDocsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`📄 Document ${index + 1}:`, {
          id: doc.id,
          company: data.company,
          companyType: typeof data.company,
          status: data.status,
          userName: data.userName,
          allFields: Object.keys(data)
        });
      });
      
      // Now try the filtered query
      let q;
      let querySnapshot;
      
      if (company === 'DEBUG_ALL' || company === 'ALL_COMPANIES') {
        // For debugging or admin viewing all companies, return all documents
        q = query(collection(db, 'forgottenCheckoutRequests'));
        querySnapshot = allDocsSnapshot; // Use the already fetched data
        console.log(company === 'DEBUG_ALL' ? '🐛 DEBUG MODE: Returning all documents' : '👑 ADMIN MODE: Returning all companies');
      } else {
        q = query(
          collection(db, 'forgottenCheckoutRequests'),
          where('company', '==', company)
        );
        querySnapshot = await getDocs(q);
      }
      console.log('📊 FILTERED Query result - Total docs found:', querySnapshot.docs.length);
      
      let requests = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        console.log('📋 Raw document data:', {
          id: doc.id,
          company: docData.company,
          status: docData.status,
          userName: docData.userName,
          submittedAt: docData.submittedAt,
          ...docData
        });
        return {
          id: doc.id,
          ...docData,
          submittedAt: docData.submittedAt?.toDate(),
          processedAt: docData.processedAt?.toDate()
        };
      });

      // Filter by status in memory if not 'all'
      if (status !== 'all') {
        requests = requests.filter(request => request.status === status);
        console.log(`📊 Filtered to ${status} status:`, requests.length, 'requests');
      }

      // Sort by submittedAt in memory
      requests.sort((a, b) => {
        if (!a.submittedAt && !b.submittedAt) return 0;
        if (!a.submittedAt) return 1;
        if (!b.submittedAt) return -1;
        return b.submittedAt - a.submittedAt;
      });

      console.log('✅ Processed and sorted requests:', requests.length);
      return requests;
    } catch (error) {
      console.error('❌ Error getting forgotten check-out requests:', error);
      return [];
    }
  },

  /**
   * Get user's own forgotten check-out requests
   */
  async getUserForgottenCheckoutRequests(userId) {
    try {
      console.log('🔍 Getting user requests for userId:', userId);
      
      const q = query(
        collection(db, 'forgottenCheckoutRequests'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      console.log('📊 User query result - Total docs found:', querySnapshot.docs.length);
      
      const requests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 User request document:', {
          id: doc.id,
          userId: data.userId,
          attendanceId: data.attendanceId,
          status: data.status,
          userName: data.userName
        });
        
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate(),
          processedAt: data.processedAt?.toDate()
        };
      });

      // Sort by submittedAt in memory
      requests.sort((a, b) => {
        if (!a.submittedAt && !b.submittedAt) return 0;
        if (!a.submittedAt) return 1;
        if (!b.submittedAt) return -1;
        return b.submittedAt - a.submittedAt;
      });

      console.log('✅ Processed and sorted user requests:', requests);
      return requests;
    } catch (error) {
      console.error('❌ Error getting user forgotten check-out requests:', error);
      return [];
    }
  },

  /**
   * Process (approve/reject) a forgotten check-out request
   */
  async processForgottenCheckoutRequest(requestId, action, adminData) {
    try {
      console.log('🔄 Processing forgotten checkout request:', { requestId, action, adminData });
      
      const {
        adminId,
        adminName,
        adminComments = '',
        rejectionReason = ''
      } = adminData;

      if (!['approve', 'reject'].includes(action)) {
        throw new Error('Invalid action. Must be "approve" or "reject".');
      }

      // Get the request first
      const requestDoc = await getDocs(query(
        collection(db, 'forgottenCheckoutRequests'),
        where('__name__', '==', requestId)
      ));

      if (requestDoc.empty) {
        throw new Error('Request not found');
      }

      const requestData = { id: requestDoc.docs[0].id, ...requestDoc.docs[0].data() };
      console.log('📄 Found request data:', requestData);

      if (requestData.status !== 'pending') {
        throw new Error('Request has already been processed');
      }

      // Update the request
      const updateData = {
        status: action === 'approve' ? 'approved' : 'rejected',
        processedAt: serverTimestamp(),
        processedBy: adminId,
        processedByName: adminName,
        adminComments,
        ...(action === 'reject' && { rejectionReason })
      };

      await updateDoc(doc(db, 'forgottenCheckoutRequests', requestId), updateData);

      // If approved, update the attendance record
      if (action === 'approve') {
        await this.updateAttendanceRecord(requestData);
      }

      // Notify the user
      await this.notifyUser(requestData.userId, {
        type: action === 'approve' ? 'checkout_request_approved' : 'checkout_request_rejected',
        title: `Check-out Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: action === 'approve' 
          ? `Your forgotten check-out request for ${(() => {
              try {
                const dateObj = requestData.date?.toDate ? requestData.date.toDate() : new Date(requestData.date);
                if (isNaN(dateObj.getTime())) return 'Unknown date';
                return format(dateObj, 'dd/MM/yyyy');
              } catch (error) {
                console.error('Error formatting date in approval message:', requestData.date, error);
                return 'Unknown date';
              }
            })()} has been approved.`
          : `Your forgotten check-out request for ${(() => {
              try {
                const dateObj = requestData.date?.toDate ? requestData.date.toDate() : new Date(requestData.date);
                if (isNaN(dateObj.getTime())) return 'Unknown date';
                return format(dateObj, 'dd/MM/yyyy');
              } catch (error) {
                console.error('Error formatting date in rejection message:', requestData.date, error);
                return 'Unknown date';
              }
            })()} has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
        requestId,
        adminComments,
        ...(action === 'reject' && { rejectionReason })
      });

      console.log(`✅ Forgotten check-out request ${action}d:`, requestId);
      return {
        success: true,
        message: `Request has been ${action}d successfully.`
      };

    } catch (error) {
      console.error('Error processing forgotten check-out request:', error);
      throw error;
    }
  },

  /**
   * Update the attendance record when request is approved
   */
  async updateAttendanceRecord(requestData) {
    try {
      console.log('📝 Updating attendance record with data:', requestData);
      
      // Handle checkInTime
      let checkInTime;
      try {
        checkInTime = requestData.checkInTime?.toDate ? requestData.checkInTime.toDate() : new Date(requestData.checkInTime);
        if (isNaN(checkInTime.getTime())) {
          throw new Error('Invalid checkInTime');
        }
      } catch (error) {
        console.error('Error parsing checkInTime:', requestData.checkInTime, error);
        throw new Error('Invalid check-in time format');
      }
      
      // Handle requestedCheckOutTime
      let checkOutTime;
      try {
        checkOutTime = requestData.requestedCheckOutTime?.toDate ? 
          requestData.requestedCheckOutTime.toDate() : 
          new Date(requestData.requestedCheckOutTime);
        if (isNaN(checkOutTime.getTime())) {
          throw new Error('Invalid requestedCheckOutTime');
        }
      } catch (error) {
        console.error('Error parsing requestedCheckOutTime:', requestData.requestedCheckOutTime, error);
        throw new Error('Invalid requested check-out time format');
      }
      
      console.log('📝 Parsed times:', { checkInTime, checkOutTime });
      
      // Calculate working hours
      const workingMilliseconds = checkOutTime - checkInTime;
      const workingHours = Math.round((workingMilliseconds / (1000 * 60 * 60)) * 100) / 100;
      
      // Calculate overtime (assuming 8 hours standard)
      const standardHours = 8;
      const overtimeHours = Math.max(0, workingHours - standardHours);

      const updateData = {
        checkOutTime: serverTimestamp(),
        actualCheckOutTime: checkOutTime, // Store the actual requested time
        workingHours,
        overtimeHours,
        forgottenCheckout: true,
        forgottenCheckoutRequestId: requestData.id || 'manual',
        notes: (requestData.notes || '') + ' [Updated via forgotten check-out request]',
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'attendance', requestData.attendanceId), updateData);
      
      console.log('✅ Attendance record updated:', requestData.attendanceId);
    } catch (error) {
      console.error('Error updating attendance record:', error);
      throw error;
    }
  },

  /**
   * Validate the requested check-out time
   */
  validateCheckoutTime(checkInTime, requestedCheckOutTime, date) {
    try {
      const checkIn = checkInTime?.toDate ? checkInTime.toDate() : new Date(checkInTime);
      const checkOut = new Date(requestedCheckOutTime);
      const now = new Date();

      // Basic validations
      if (isBefore(checkOut, checkIn)) {
        return {
          valid: false,
          message: 'Check-out time cannot be before check-in time'
        };
      }

      // Check if it's not in the future (except for today)
      const dateString = (() => {
        try {
          if (date?.toDate) {
            return format(date.toDate(), 'yyyy-MM-dd');
          } else if (typeof date === 'string') {
            return date.split('T')[0];
          } else {
            return format(new Date(date), 'yyyy-MM-dd');
          }
        } catch (error) {
          return format(now, 'yyyy-MM-dd');
        }
      })();
      
      const isToday = dateString === format(now, 'yyyy-MM-dd');
      if (!isToday && isAfter(checkOut, new Date(dateString + 'T23:59:59'))) {
        return {
          valid: false,
          message: 'Check-out time cannot be in the future for past dates'
        };
      }

      // Calculate working hours
      const workingMinutes = differenceInMinutes(checkOut, checkIn);
      const workingHours = workingMinutes / 60;

      // Reasonable time validation
      const minimumHours = 1; // Minimum 1 hour
      const maximumHours = 16; // Maximum 16 hours

      if (workingHours < minimumHours) {
        return {
          valid: false,
          message: `Working hours cannot be less than ${minimumHours} hour(s)`
        };
      }

      if (workingHours > maximumHours) {
        return {
          valid: false,
          message: `Working hours cannot exceed ${maximumHours} hours`
        };
      }

      // Warning for unusual hours
      let warningMessage = '';
      if (workingHours > 12) {
        warningMessage = 'Long working hours detected. Please provide justification.';
      } else if (workingHours < 4) {
        warningMessage = 'Short working hours detected. Please provide reason.';
      }

      return {
        valid: true,
        minimumHours,
        maximumHours,
        workingHours,
        isReasonable: workingHours >= 6 && workingHours <= 10,
        warningMessage
      };

    } catch (error) {
      return {
        valid: false,
        message: 'Invalid date/time format'
      };
    }
  },

  /**
   * Calculate working hours between check-in and check-out
   */
  calculateWorkingHours(checkInTime, checkOutTime) {
    try {
      const checkIn = checkInTime?.toDate ? checkInTime.toDate() : new Date(checkInTime);
      const checkOut = new Date(checkOutTime);
      
      const workingMinutes = differenceInMinutes(checkOut, checkIn);
      return Math.round((workingMinutes / 60) * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      return 0;
    }
  },

  /**
   * Notify admins about new requests
   */
  async notifyAdmins(company, notificationData) {
    try {
      console.log('🔔 Notifying admins for company:', company);
      
      // Try both company field names to ensure compatibility
      const adminsQuery1 = query(
        collection(db, 'users'),
        where('role', '==', 'admin'),
        where('company', '==', company)
      );
      
      const adminsQuery2 = query(
        collection(db, 'users'),
        where('role', '==', 'admin'),
        where('originalCompanyName', '==', company)
      );

      const [adminsSnapshot1, adminsSnapshot2] = await Promise.all([
        getDocs(adminsQuery1),
        getDocs(adminsQuery2)
      ]);
      
      // Combine results and deduplicate by admin ID
      const allAdminDocs = [...adminsSnapshot1.docs, ...adminsSnapshot2.docs];
      const uniqueAdminDocs = allAdminDocs.filter((doc, index, array) => 
        array.findIndex(d => d.id === doc.id) === index
      );
      
      console.log('👥 Found', uniqueAdminDocs.length, 'admin(s) to notify');
      
      if (uniqueAdminDocs.length === 0) {
        console.warn('⚠️ No admins found for company:', company);
        return;
      }
      
      const notificationPromises = uniqueAdminDocs.map(adminDoc => {
        const admin = adminDoc.data();
        console.log('📬 Sending notification to admin:', {
          id: adminDoc.id,
          email: admin.email,
          name: `${admin.firstName} ${admin.lastName}`
        });
        
        const notification = {
          userId: adminDoc.id,
          ...notificationData,
          priority: 'medium',
          read: false,
          createdAt: serverTimestamp()
        };
        
        return addDoc(collection(db, 'notifications'), notification);
      });

      await Promise.all(notificationPromises);
      console.log('✅ Successfully sent notifications to all admins');
    } catch (error) {
      console.error('❌ Error notifying admins:', error);
    }
  },

  /**
   * Notify user about request status
   */
  async notifyUser(userId, notificationData) {
    try {
      const notification = {
        userId,
        ...notificationData,
        priority: 'high',
        read: false,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'notifications'), notification);
    } catch (error) {
      console.error('Error notifying user:', error);
    }
  },

  /**
   * Get statistics for admin dashboard
   */
  async getForgottenCheckoutStats(company, dateRange = 30) {
    try {
      console.log('📈 Querying stats for company:', company);

      // Get requests - all companies for admin, specific company for others
      let q;
      if (company === 'ALL_COMPANIES') {
        q = query(collection(db, 'forgottenCheckoutRequests'));
        console.log('👑 ADMIN STATS: Getting stats for all companies');
      } else {
        q = query(
          collection(db, 'forgottenCheckoutRequests'),
          where('company', '==', company)
        );
      }

      const querySnapshot = await getDocs(q);
      console.log('📊 Stats query result - Total docs found:', querySnapshot.docs.length);
      
      // Filter by date range in memory to avoid complex index requirements
      const endDate = new Date();
      const startDate = new Date(endDate - dateRange * 24 * 60 * 60 * 1000);
      
      const requests = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate()
        }))
        .filter(request => {
          if (!request.submittedAt) return false;
          return request.submittedAt >= startDate && request.submittedAt <= endDate;
        });

      console.log('📊 Filtered requests within date range:', requests.length);

      const totalRequests = requests.length;
      const pendingRequests = requests.filter(r => r.status === 'pending').length;
      const approvedRequests = requests.filter(r => r.status === 'approved').length;
      const rejectedRequests = requests.filter(r => r.status === 'rejected').length;

      const approvalRate = totalRequests > 0 ? ((approvedRequests / (approvedRequests + rejectedRequests)) * 100).toFixed(1) : 0;

      const stats = {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        approvalRate: parseFloat(approvalRate),
        dateRange: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd')
        }
      };
      
      console.log('📈 Calculated stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error getting forgotten checkout stats:', error);
      return null;
    }
  },

  /**
   * Check if user can submit a request for a specific date
   */
  async canSubmitRequest(userId, date, attendanceId) {
    try {
      // Check if there's already a pending request for this attendance record
      const existingRequestQuery = query(
        collection(db, 'forgottenCheckoutRequests'),
        where('userId', '==', userId),
        where('attendanceId', '==', attendanceId),
        where('status', '==', 'pending')
      );

      const existingSnapshot = await getDocs(existingRequestQuery);
      
      if (!existingSnapshot.empty) {
        return {
          canSubmit: false,
          message: 'You already have a pending request for this date.'
        };
      }

      // Check if the date is not too old (e.g., max 7 days ago)
      const requestDate = (() => {
        try {
          return date?.toDate ? date.toDate() : new Date(date);
        } catch (error) {
          return new Date();
        }
      })();
      const now = new Date();
      const daysDifference = differenceInMinutes(now, requestDate) / (60 * 24);

      if (daysDifference > 7) {
        return {
          canSubmit: false,
          message: 'Cannot submit requests for dates older than 7 days.'
        };
      }

      return {
        canSubmit: true,
        message: 'You can submit a request for this date.'
      };
    } catch (error) {
      console.error('Error checking if user can submit request:', error);
      return {
        canSubmit: false,
        message: 'Error checking request eligibility.'
      };
    }
  }
};