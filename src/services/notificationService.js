import { 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp 
} from 'firebase/firestore';
import { firestoreService } from './dataService';

/**
 * Notification Management Service
 */
export const notificationService = {
  // Create notification
  async createNotification(notificationData) {
    try {
      const notification = {
        ...notificationData,
        read: false,
        createdAt: serverTimestamp()
      };

      const notificationId = await firestoreService.create('notifications', notification);
      return { id: notificationId, ...notification };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    try {
      const { read, type, pageSize = 20, lastDoc } = options;
      
      let queryConstraints = [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      ];

      if (typeof read === 'boolean') {
        queryConstraints.splice(1, 0, where('read', '==', read));
      }

      if (type && type !== 'all') {
        queryConstraints.splice(-1, 0, where('type', '==', type));
      }

      if (pageSize) {
        queryConstraints.push(limit(pageSize));
      }

      if (lastDoc) {
        queryConstraints.push(startAfter(lastDoc));
      }

      return await firestoreService.get('notifications', queryConstraints);
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  },

  // Get company notifications (for admin)
  async getCompanyNotifications(companyName, options = {}) {
    try {
      const { type, priority, read, pageSize = 50 } = options;
      
      let queryConstraints = [
        where('companyName', '==', companyName),
        orderBy('createdAt', 'desc')
      ];

      if (type && type !== 'all') {
        queryConstraints.splice(1, 0, where('type', '==', type));
      }

      if (priority) {
        queryConstraints.splice(-1, 0, where('priority', '==', priority));
      }

      if (typeof read === 'boolean') {
        queryConstraints.splice(-1, 0, where('read', '==', read));
      }

      if (pageSize) {
        queryConstraints.push(limit(pageSize));
      }

      return await firestoreService.get('notifications', queryConstraints);
    } catch (error) {
      console.error('Error getting company notifications:', error);
      throw error;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      await firestoreService.update('notifications', notificationId, {
        read: true,
        readAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark multiple notifications as read
  async markMultipleAsRead(notificationIds) {
    try {
      const batchOperations = notificationIds.map(id => ({
        type: 'update',
        collectionName: 'notifications',
        id,
        data: {
          read: true,
          readAt: serverTimestamp()
        }
      }));

      await firestoreService.batch(batchOperations);
      return true;
    } catch (error) {
      console.error('Error marking multiple notifications as read:', error);
      throw error;
    }
  },

  // Mark all user notifications as read
  async markAllAsRead(userId) {
    try {
      const unreadNotifications = await this.getUserNotifications(userId, { 
        read: false, 
        pageSize: 100 
      });

      if (unreadNotifications.length > 0) {
        const notificationIds = unreadNotifications.map(n => n.id);
        await this.markMultipleAsRead(notificationIds);
      }

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      await firestoreService.delete('notifications', notificationId);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Delete multiple notifications
  async deleteMultiple(notificationIds) {
    try {
      const batchOperations = notificationIds.map(id => ({
        type: 'delete',
        collectionName: 'notifications',
        id
      }));

      await firestoreService.batch(batchOperations);
      return true;
    } catch (error) {
      console.error('Error deleting multiple notifications:', error);
      throw error;
    }
  },

  // Get notification statistics
  async getNotificationStats(userId) {
    try {
      const notifications = await this.getUserNotifications(userId, { pageSize: 1000 });
      
      const stats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        read: notifications.filter(n => n.read).length,
        byType: {},
        byPriority: {},
        recent: notifications.slice(0, 5)
      };

      notifications.forEach(notification => {
        // By type
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        
        // By priority
        const priority = notification.priority || 'normal';
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  },

  // Create leave notification
  async createLeaveNotification(leaveId, status, userId) {
    try {
      const leave = await firestoreService.getById('leaves', leaveId);
      
      if (!leave) {
        throw new Error('Leave record not found');
      }

      let title = '';
      let message = '';
      let priority = 'normal';

      switch (status) {
        case 'submitted':
          title = 'Leave Application Submitted';
          message = `Your ${leave.leaveType} leave application has been submitted successfully`;
          break;
        case 'approved':
          title = 'Leave Approved';
          message = `Your ${leave.leaveType} leave application has been approved`;
          priority = 'high';
          break;
        case 'rejected':
          title = 'Leave Rejected';
          message = `Your ${leave.leaveType} leave application has been rejected`;
          priority = 'high';
          break;
        case 'cancelled':
          title = 'Leave Cancelled';
          message = `Your ${leave.leaveType} leave application has been cancelled`;
          break;
        case 'pending_approval':
          title = 'Leave Pending Approval';
          message = `A new ${leave.leaveType} leave application from ${leave.userName} is pending approval`;
          break;
        default:
          title = 'Leave Update';
          message = 'Your leave application status has been updated';
      }

      const notification = {
        userId: userId || leave.userId,
        type: 'leave_update',
        title,
        message,
        priority,
        leaveId,
        relatedData: {
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays
        }
      };

      return await this.createNotification(notification);
    } catch (error) {
      console.error('Error creating leave notification:', error);
      throw error;
    }
  },

  // Create claim notification
  async createClaimNotification(claimId, status, userId) {
    try {
      const claim = await firestoreService.getById('claims', claimId);
      
      if (!claim) {
        throw new Error('Claim record not found');
      }

      let title = '';
      let message = '';
      let priority = 'normal';

      switch (status) {
        case 'submitted':
          title = 'Claim Submitted';
          message = `Your ${claim.category} claim (${claim.currency} ${claim.amount}) has been submitted`;
          break;
        case 'approved':
          title = 'Claim Approved';
          message = `Your ${claim.category} claim has been approved`;
          priority = 'high';
          break;
        case 'rejected':
          title = 'Claim Rejected';
          message = `Your ${claim.category} claim has been rejected`;
          priority = 'high';
          break;
        case 'cancelled':
          title = 'Claim Cancelled';
          message = `Your ${claim.category} claim has been cancelled`;
          break;
        case 'pending_approval':
          title = 'Claim Pending Approval';
          message = `A new ${claim.category} claim from ${claim.userName} (${claim.currency} ${claim.amount}) is pending approval`;
          break;
        default:
          title = 'Claim Update';
          message = 'Your claim status has been updated';
      }

      const notification = {
        userId: userId || claim.userId,
        type: 'claim_update',
        title,
        message,
        priority,
        claimId,
        relatedData: {
          claimType: claim.claimType,
          category: claim.category,
          amount: claim.amount,
          currency: claim.currency
        }
      };

      return await this.createNotification(notification);
    } catch (error) {
      console.error('Error creating claim notification:', error);
      throw error;
    }
  },

  // Create attendance notification
  async createAttendanceNotification(attendanceId, type, userId) {
    try {
      const attendance = await firestoreService.getById('attendance', attendanceId);
      
      if (!attendance) {
        throw new Error('Attendance record not found');
      }

      let title = '';
      let message = '';
      let priority = 'normal';

      switch (type) {
        case 'clock_in':
          title = 'Clocked In';
          message = `Successfully clocked in at ${new Date().toLocaleTimeString()}`;
          break;
        case 'clock_out':
          title = 'Clocked Out';
          message = `Successfully clocked out at ${new Date().toLocaleTimeString()}`;
          break;
        case 'late_arrival':
          title = 'Late Arrival';
          message = 'You have been marked as late for today';
          priority = 'medium';
          break;
        case 'missed_clock_out':
          title = 'Missed Clock Out';
          message = 'You forgot to clock out yesterday';
          priority = 'medium';
          break;
        case 'overtime':
          title = 'Overtime Recorded';
          message = `Overtime of ${attendance.overtimeHours} hours recorded`;
          break;
        default:
          title = 'Attendance Update';
          message = 'Your attendance has been updated';
      }

      const notification = {
        userId: userId || attendance.userId,
        type: 'attendance_update',
        title,
        message,
        priority,
        attendanceId,
        relatedData: {
          date: attendance.date,
          workingHours: attendance.workingHours,
          overtimeHours: attendance.overtimeHours
        }
      };

      return await this.createNotification(notification);
    } catch (error) {
      console.error('Error creating attendance notification:', error);
      throw error;
    }
  },

  // Create system notification
  async createSystemNotification(notificationData) {
    try {
      const notification = {
        ...notificationData,
        type: 'system',
        priority: notificationData.priority || 'normal'
      };

      return await this.createNotification(notification);
    } catch (error) {
      console.error('Error creating system notification:', error);
      throw error;
    }
  },

  // Broadcast notification to multiple users
  async broadcastNotification(userIds, notificationData) {
    try {
      const notifications = userIds.map(userId => ({
        type: 'create',
        collectionName: 'notifications',
        data: {
          ...notificationData,
          userId,
          read: false,
          createdAt: serverTimestamp()
        }
      }));

      await firestoreService.batch(notifications);
      return true;
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  },

  // Broadcast to company
  async broadcastToCompany(companyName, notificationData, excludeUserIds = []) {
    try {
      // Get all users in the company
      const users = await firestoreService.get('users', [
        where('companyName', '==', companyName)
      ]);

      const userIds = users
        .map(user => user.id)
        .filter(userId => !excludeUserIds.includes(userId));

      if (userIds.length > 0) {
        await this.broadcastNotification(userIds, {
          ...notificationData,
          companyName
        });
      }

      return userIds.length;
    } catch (error) {
      console.error('Error broadcasting to company:', error);
      throw error;
    }
  },

  // Broadcast to department
  async broadcastToDepartment(companyName, department, notificationData, excludeUserIds = []) {
    try {
      // Get all users in the department
      const users = await firestoreService.get('users', [
        where('companyName', '==', companyName),
        where('department', '==', department)
      ]);

      const userIds = users
        .map(user => user.id)
        .filter(userId => !excludeUserIds.includes(userId));

      if (userIds.length > 0) {
        await this.broadcastNotification(userIds, {
          ...notificationData,
          companyName,
          department
        });
      }

      return userIds.length;
    } catch (error) {
      console.error('Error broadcasting to department:', error);
      throw error;
    }
  },

  // Clean up old notifications
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldNotifications = await firestoreService.get('notifications', [
        where('createdAt', '<=', cutoffDate),
        limit(500)
      ]);

      if (oldNotifications.length > 0) {
        const notificationIds = oldNotifications.map(n => n.id);
        await this.deleteMultiple(notificationIds);
      }

      return oldNotifications.length;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  },

  // Get notification templates
  getNotificationTemplates() {
    return {
      leave: {
        submitted: {
          title: 'Leave Application Submitted',
          message: 'Your {{leaveType}} leave application has been submitted successfully'
        },
        approved: {
          title: 'Leave Approved',
          message: 'Your {{leaveType}} leave application has been approved',
          priority: 'high'
        },
        rejected: {
          title: 'Leave Rejected',
          message: 'Your {{leaveType}} leave application has been rejected',
          priority: 'high'
        }
      },
      claim: {
        submitted: {
          title: 'Claim Submitted',
          message: 'Your {{category}} claim ({{currency}} {{amount}}) has been submitted'
        },
        approved: {
          title: 'Claim Approved',
          message: 'Your {{category}} claim has been approved',
          priority: 'high'
        },
        rejected: {
          title: 'Claim Rejected',
          message: 'Your {{category}} claim has been rejected',
          priority: 'high'
        }
      },
      attendance: {
        clock_in: {
          title: 'Clocked In',
          message: 'Successfully clocked in at {{time}}'
        },
        clock_out: {
          title: 'Clocked Out',
          message: 'Successfully clocked out at {{time}}'
        },
        late_arrival: {
          title: 'Late Arrival',
          message: 'You have been marked as late for today',
          priority: 'medium'
        }
      }
    };
  },

  // Listen to user notifications (real-time)
  listenToUserNotifications(userId, callback) {
    return firestoreService.listen('notifications', [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    ], callback);
  },

  // Listen to company notifications (real-time for admin)
  listenToCompanyNotifications(companyName, callback) {
    return firestoreService.listen('notifications', [
      where('companyName', '==', companyName),
      orderBy('createdAt', 'desc'),
      limit(100)
    ], callback);
  }
};