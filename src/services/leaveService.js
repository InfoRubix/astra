import { 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp 
} from 'firebase/firestore';
import { firestoreService, storageService } from './dataService';

/**
 * Leave Management Service
 */
export const leaveService = {
  // Submit leave application
  async applyLeave(leaveData, supportingFiles = []) {
    try {
      // Validate leave application
      const validationErrors = this.validateLeave(leaveData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      // Convert supporting documents to Base64 (free tier workaround)
      let documents = [];
      if (supportingFiles.length > 0) {
        for (const file of supportingFiles) {
          if (file.size > 1024 * 1024) { // 1MB limit for Base64
            throw new Error(`File ${file.name} is too large. Maximum size is 1MB.`);
          }
          
          const base64 = await this.fileToBase64(file);
          documents.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      // Calculate leave days
      const totalDays = this.calculateLeaveDays(leaveData.startDate, leaveData.endDate);

      // Create leave record
      const leaveRecord = {
        ...leaveData,
        documents: documents,
        status: 'pending',
        appliedDate: serverTimestamp(),
        totalDays,
        documentCount: supportingFiles.length
      };

      const leaveId = await firestoreService.create('leaves', leaveRecord);
      
      // Send notification to admin
      await this.sendLeaveNotification(leaveId, 'submitted');
      
      return { id: leaveId, ...leaveRecord };
    } catch (error) {
      console.error('Error applying for leave:', error);
      throw error;
    }
  },

  // Convert file to Base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Get user leaves with filtering options
  async getUserLeaves(userId, options = {}) {
    try {
      const { status, leaveType, startDate, endDate, pageSize = 20 } = options;
      
      // Simple query to avoid composite index issues
      let queryConstraints = [
        where('userId', '==', userId)
      ];

      const leaves = await firestoreService.get('leaves', queryConstraints);
      
      // Client-side filtering and sorting
      let filteredLeaves = leaves;
      
      if (status && status !== 'all') {
        filteredLeaves = filteredLeaves.filter(leave => leave.status === status);
      }
      
      if (leaveType && leaveType !== 'all') {
        filteredLeaves = filteredLeaves.filter(leave => leave.leaveType === leaveType);
      }
      
      if (startDate) {
        const filterDate = new Date(startDate);
        filteredLeaves = filteredLeaves.filter(leave => {
          const leaveDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
          return leaveDate >= filterDate;
        });
      }
      
      if (endDate) {
        const filterDate = new Date(endDate);
        filteredLeaves = filteredLeaves.filter(leave => {
          const leaveDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
          return leaveDate <= filterDate;
        });
      }
      
      // Sort by applied date (most recent first)
      filteredLeaves.sort((a, b) => {
        const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
        const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
        return bDate - aDate;
      });
      
      // Apply pagination
      return filteredLeaves.slice(0, pageSize);
    } catch (error) {
      console.error('Error getting user leaves:', error);
      throw error;
    }
  },

  // Get company leaves (for admin)
  async getCompanyLeaves(company, options = {}) {
    try {
      const { status, department, leaveType, startDate, endDate, pageSize = 50 } = options;
      
      // Simple query to avoid composite index issues
      let queryConstraints = [
        where('company', '==', company)
      ];

      const leaves = await firestoreService.get('leaves', queryConstraints);
      
      // Client-side filtering and sorting
      let filteredLeaves = leaves;
      
      if (status && status !== 'all') {
        filteredLeaves = filteredLeaves.filter(leave => leave.status === status);
      }
      
      if (department) {
        filteredLeaves = filteredLeaves.filter(leave => leave.department === department);
      }
      
      if (leaveType && leaveType !== 'all') {
        filteredLeaves = filteredLeaves.filter(leave => leave.leaveType === leaveType);
      }
      
      if (startDate || endDate) {
        filteredLeaves = filteredLeaves.filter(leave => {
          const leaveDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
          if (startDate && leaveDate < new Date(startDate)) return false;
          if (endDate && leaveDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      // Sort by applied date (most recent first)
      filteredLeaves.sort((a, b) => {
        const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
        const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
        return bDate - aDate;
      });
      
      // Apply pagination
      return filteredLeaves.slice(0, pageSize);
    } catch (error) {
      console.error('Error getting company leaves:', error);
      throw error;
    }
  },

  // Approve leave
  async approveLeave(leaveId, adminUserId, adminName, comments = '') {
    try {
      const leave = await firestoreService.getById('leaves', leaveId);
      
      const updateData = {
        status: 'approved',
        approvedBy: adminName,
        approvedById: adminUserId,
        approvedDate: serverTimestamp(),
        adminComments: comments
      };

      await firestoreService.update('leaves', leaveId, updateData);
      
      // Send notification to user
      await this.sendLeaveNotification(leaveId, 'approved');
      
      // Update leave balance
      await this.updateLeaveBalance(leave.userId, leave.leaveType, leave.totalDays);
      
      return updateData;
    } catch (error) {
      console.error('Error approving leave:', error);
      throw error;
    }
  },

  // Reject leave
  async rejectLeave(leaveId, adminUserId, adminName, reason) {
    try {
      const updateData = {
        status: 'rejected',
        rejectedBy: adminName,
        rejectedById: adminUserId,
        rejectedDate: serverTimestamp(),
        rejectionReason: reason
      };

      await firestoreService.update('leaves', leaveId, updateData);
      
      // Send notification to user
      await this.sendLeaveNotification(leaveId, 'rejected');
      
      return updateData;
    } catch (error) {
      console.error('Error rejecting leave:', error);
      throw error;
    }
  },

  // Cancel leave (by user)
  async cancelLeave(leaveId, userId) {
    try {
      const leave = await firestoreService.getById('leaves', leaveId);
      
      if (!leave || leave.userId !== userId) {
        throw new Error('Leave not found or unauthorized');
      }

      if (leave.status !== 'pending') {
        throw new Error('Only pending leaves can be cancelled');
      }

      await firestoreService.update('leaves', leaveId, {
        status: 'cancelled',
        cancelledDate: serverTimestamp()
      });
      
      // For Base64 storage, no need to delete files separately
      // They are stored in the document itself
      
      return true;
    } catch (error) {
      console.error('Error cancelling leave:', error);
      throw error;
    }
  },

  // Get leave balance for user
  async getUserLeaveBalance(userId, year = null) {
    try {
      const user = await firestoreService.getById('users', userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const currentYear = year || new Date().getFullYear();
      const leaveBalance = user.leaveBalance || this.getDefaultLeaveBalance();

      // Calculate used leaves for the specified year
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      // Fetch approved leaves and filter by year client-side to avoid composite index issues
      const allApprovedLeaves = await firestoreService.get('leaves', [
        where('userId', '==', userId),
        where('status', '==', 'approved')
      ]);
      const approvedLeaves = allApprovedLeaves.filter(leave => {
        const start = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        return start >= startOfYear && start <= endOfYear;
      });

      const usedLeaves = {
        annual: 0,
        sick: 0,
        emergency: 0,
        maternity: 0,
        paternity: 0,
        compassionate: 0
      };

      approvedLeaves.forEach(leave => {
        if (usedLeaves[leave.leaveType] !== undefined) {
          usedLeaves[leave.leaveType] += leave.totalDays || 0;
        }
      });

      const availableLeaves = {};
      Object.keys(leaveBalance).forEach(type => {
        availableLeaves[type] = Math.max(0, leaveBalance[type] - (usedLeaves[type] || 0));
      });

      return {
        total: leaveBalance,
        used: usedLeaves,
        available: availableLeaves,
        year: currentYear
      };
    } catch (error) {
      console.error('Error getting leave balance:', error);
      throw error;
    }
  },

  // Calculate leave days (excluding weekends and holidays)
  calculateLeaveDays(startDate, endDate, excludeWeekends = true, holidays = []) {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Convert holidays to date strings for easy comparison
    const holidayDates = holidays.map(h => new Date(h).toDateString());
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const currentDateString = current.toDateString();
      
      // Check if it's a holiday
      const isHoliday = holidayDates.includes(currentDateString);
      
      // Check if it's a weekend
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      
      // Count the day if it's not a holiday and (not weekend or weekends are included)
      if (!isHoliday && (!isWeekend || !excludeWeekends)) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  },

  // Get leave types and policies
  getLeaveTypes() {
    return [
      {
        type: 'annual',
        name: 'Annual Leave',
        maxDays: 15,
        carryForward: 5,
        description: 'Yearly vacation leave',
        requiresApproval: true,
        advanceNotice: 7,
        documentRequired: false
      },
      {
        type: 'sick',
        name: 'Sick Leave',
        maxDays: 14,
        carryForward: 0,
        description: 'Medical leave',
        requiresApproval: true,
        advanceNotice: 0,
        documentRequired: true
      },
      {
        type: 'emergency',
        name: 'Emergency Leave',
        maxDays: 3,
        carryForward: 0,
        description: 'Urgent personal matters',
        requiresApproval: true,
        advanceNotice: 0,
        documentRequired: false
      },
      {
        type: 'maternity',
        name: 'Maternity Leave',
        maxDays: 90,
        carryForward: 0,
        description: 'Maternity leave',
        requiresApproval: true,
        advanceNotice: 30,
        documentRequired: true
      },
      {
        type: 'paternity',
        name: 'Paternity Leave',
        maxDays: 14,
        carryForward: 0,
        description: 'Paternity leave',
        requiresApproval: true,
        advanceNotice: 7,
        documentRequired: true
      },
      {
        type: 'compassionate',
        name: 'Compassionate Leave',
        maxDays: 5,
        carryForward: 0,
        description: 'Bereavement or family emergencies',
        requiresApproval: true,
        advanceNotice: 0,
        documentRequired: false
      }
    ];
  },

  // Get default leave balance
  getDefaultLeaveBalance() {
    return {
      annual: 15,
      sick: 14,
      emergency: 3,
      maternity: 90,
      paternity: 14,
      compassionate: 5
    };
  },

  // Validate leave application
  validateLeave(leaveData) {
    const errors = [];
    
    if (!leaveData.leaveType) {
      errors.push('Leave type is required');
    }
    
    if (!leaveData.startDate) {
      errors.push('Start date is required');
    }
    
    if (!leaveData.endDate) {
      errors.push('End date is required');
    }
    
    if (!leaveData.reason?.trim()) {
      errors.push('Reason is required');
    }

    if (leaveData.startDate && leaveData.endDate) {
      const start = new Date(leaveData.startDate);
      const end = new Date(leaveData.endDate);
      
      if (start > end) {
        errors.push('Start date cannot be after end date');
      }
      
      // Check if dates are in the past (except for certain leave types)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (start < today && !['sick', 'emergency', 'compassionate'].includes(leaveData.leaveType)) {
        errors.push('Cannot apply for past dates for this leave type');
      }
    }

    // Check leave type specific validations
    const leaveType = this.getLeaveTypes().find(t => t.type === leaveData.leaveType);
    if (leaveType) {
      const totalDays = this.calculateLeaveDays(leaveData.startDate, leaveData.endDate);
      
      if (totalDays > leaveType.maxDays) {
        errors.push(`Cannot exceed ${leaveType.maxDays} days for ${leaveType.name}`);
      }
      
      // Check advance notice requirement
      if (leaveType.advanceNotice > 0) {
        const noticeDate = new Date();
        noticeDate.setDate(noticeDate.getDate() + leaveType.advanceNotice);
        
        if (new Date(leaveData.startDate) < noticeDate) {
          errors.push(`${leaveType.name} requires ${leaveType.advanceNotice} days advance notice`);
        }
      }
    }

    return errors;
  },

  // Get leave statistics
  async getLeaveStatistics(company, options = {}) {
    try {
      const { startDate, endDate, department } = options;
      
      let queryConstraints = [
        where('company', '==', company)
      ];

      if (department) {
        queryConstraints.push(where('department', '==', department));
      }

      if (startDate && endDate) {
        queryConstraints.push(
          where('appliedDate', '>=', startDate),
          where('appliedDate', '<=', endDate)
        );
      }

      const leaves = await firestoreService.get('leaves', queryConstraints);
      
      // Calculate statistics
      const stats = {
        total: leaves.length,
        pending: leaves.filter(l => l.status === 'pending').length,
        approved: leaves.filter(l => l.status === 'approved').length,
        rejected: leaves.filter(l => l.status === 'rejected').length,
        totalDays: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.totalDays || 0), 0),
        byType: {},
        byDepartment: {},
        byMonth: {}
      };

      leaves.forEach(leave => {
        // By type
        stats.byType[leave.leaveType] = (stats.byType[leave.leaveType] || 0) + 1;
        
        // By department
        stats.byDepartment[leave.department] = (stats.byDepartment[leave.department] || 0) + 1;
        
        // By month
        const month = new Date(leave.appliedDate?.toDate?.() || leave.appliedDate).getMonth();
        const monthName = new Date(2025, month).toLocaleString('default', { month: 'long' });
        stats.byMonth[monthName] = (stats.byMonth[monthName] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting leave statistics:', error);
      throw error;
    }
  },

  // Send leave notification
  async sendLeaveNotification(leaveId, status) {
    try {
      const leave = await firestoreService.getById('leaves', leaveId);
      
      if (leave) {
        const notification = {
          userId: leave.userId,
          type: 'leave_update',
          title: `Leave ${status}`,
          message: `Your ${leave.leaveType} leave application (${leave.totalDays} days) has been ${status}`,
          leaveId: leaveId,
          read: false,
          createdAt: serverTimestamp()
        };
        
        await firestoreService.create('notifications', notification);
      }
    } catch (error) {
      console.error('Error sending leave notification:', error);
    }
  },

  // Update leave balance
  async updateLeaveBalance(userId, leaveType, days) {
    try {
      const user = await firestoreService.getById('users', userId);
      
      if (user) {
        const currentBalance = user.leaveBalance || this.getDefaultLeaveBalance();
        const updatedBalance = { ...currentBalance };
        
        if (updatedBalance[leaveType] !== undefined) {
          updatedBalance[leaveType] = Math.max(0, updatedBalance[leaveType] - days);
        }
        
        await firestoreService.update('users', userId, {
          leaveBalance: updatedBalance,
          lastLeaveUpdate: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating leave balance:', error);
    }
  },

  // Listen to user leaves (real-time)
  listenToUserLeaves(userId, callback) {
    return firestoreService.listen('leaves', [
      where('userId', '==', userId),
      orderBy('appliedDate', 'desc')
    ], callback);
  },

  // Listen to company leaves (real-time for admin)
  listenToCompanyLeaves(company, callback) {
    return firestoreService.listen('leaves', [
      where('company', '==', company),
      orderBy('appliedDate', 'desc'),
      limit(100)
    ], callback);
  },

  // Generate leave report
  async generateLeaveReport(company, options = {}) {
    try {
      const { startDate, endDate, format = 'summary' } = options;
      
      const leaves = await this.getCompanyLeaves(company, { 
        startDate, 
        endDate, 
        pageSize: 1000 
      });

      if (format === 'summary') {
        return this.getLeaveStatistics(company, options);
      } else {
        // Detailed report
        return {
          period: { startDate, endDate },
          totalLeaves: leaves.length,
          leaves: leaves.map(leave => ({
            id: leave.id,
            employee: leave.userName,
            department: leave.department,
            type: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            totalDays: leave.totalDays,
            status: leave.status,
            appliedDate: leave.appliedDate,
            approvedBy: leave.approvedBy
          }))
        };
      }
    } catch (error) {
      console.error('Error generating leave report:', error);
      throw error;
    }
  }
};