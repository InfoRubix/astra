import { 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { firestoreService, storageService } from './dataService';

/**
 * Employee Profile Management Service
 */
export const profileService = {
  // Get user profile
  async getProfile(userId) {
    try {
      return await firestoreService.getById('users', userId);
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userId, profileData, profileImage = null) {
    try {
      let updateData = { ...profileData };

      // Upload profile image if provided
      if (profileImage) {
        const imagePath = `profiles/${userId}/avatar_${Date.now()}.jpg`;
        const imageUpload = await storageService.uploadFile(profileImage, imagePath);
        updateData.profileImage = imageUpload.url;
        updateData.profileImagePath = imageUpload.path;
      }

      // Remove sensitive fields that shouldn't be updated through profile
      delete updateData.role;
      delete updateData.companyName;
      delete updateData.employeeId;
      delete updateData.salary;
      delete updateData.leaveBalance;

      await firestoreService.update('users', userId, updateData);
      
      // Get updated profile
      return await this.getProfile(userId);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Update profile settings
  async updateSettings(userId, settings) {
    try {
      const updateData = {
        settings: {
          ...settings,
          updatedAt: new Date().toISOString()
        }
      };

      await firestoreService.update('users', userId, updateData);
      return updateData.settings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  // Get user settings
  async getSettings(userId) {
    try {
      const user = await this.getProfile(userId);
      return user?.settings || this.getDefaultSettings();
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  // Get default user settings
  getDefaultSettings() {
    return {
      notifications: {
        email: {
          leaveUpdates: true,
          claimUpdates: true,
          attendanceReminders: true,
          systemAnnouncements: true
        },
        push: {
          leaveUpdates: true,
          claimUpdates: true,
          attendanceReminders: false,
          systemAnnouncements: false
        },
        frequency: 'immediate' // immediate, daily, weekly
      },
      privacy: {
        showProfileToColleagues: true,
        showAttendanceToColleagues: false,
        showLeaveStatusToColleagues: true
      },
      preferences: {
        theme: 'light', // light, dark, auto
        language: 'en',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h', // 12h, 24h
        currency: 'USD'
      },
      dashboard: {
        showQuickActions: true,
        showRecentActivity: true,
        showUpcomingLeaves: true,
        showPendingClaims: true,
        defaultView: 'overview' // overview, attendance, leaves, claims
      }
    };
  },

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const { getAuth, signInWithEmailAndPassword, updatePassword } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Validate password requirements
      const passwordValidation = this.validatePassword(newPassword);
      if (passwordValidation.errors.length > 0) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Re-authenticate with current password first
      await signInWithEmailAndPassword(auth, currentUser.email, currentPassword);

      // Update password in Firebase Auth
      await updatePassword(currentUser, newPassword);

      // Update timestamp in Firestore
      await firestoreService.update('users', userId, {
        passwordChangedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      }
      if (error.code === 'auth/weak-password') {
        throw new Error('New password is too weak');
      }
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please log out and log in again before changing your password');
      }
      throw error;
    }
  },

  // Validate password
  validatePassword(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Update emergency contact
  async updateEmergencyContact(userId, emergencyContact) {
    try {
      const updateData = {
        emergencyContact: {
          name: emergencyContact.name,
          relationship: emergencyContact.relationship,
          phone: emergencyContact.phone,
          email: emergencyContact.email,
          address: emergencyContact.address,
          updatedAt: new Date().toISOString()
        }
      };

      await firestoreService.update('users', userId, updateData);
      return updateData.emergencyContact;
    } catch (error) {
      console.error('Error updating emergency contact:', error);
      throw error;
    }
  },

  // Get employee directory (company colleagues)
  async getEmployeeDirectory(companyName, options = {}) {
    try {
      const { department, searchTerm, pageSize = 50 } = options;
      
      let queryConstraints = [
        where('companyName', '==', companyName),
        where('status', '==', 'active'),
        orderBy('firstName', 'asc')
      ];

      if (department && department !== 'all') {
        queryConstraints.splice(-1, 0, where('department', '==', department));
      }

      if (pageSize) {
        queryConstraints.push(limit(pageSize));
      }

      let employees = await firestoreService.get('users', queryConstraints);

      // Filter by search term if provided
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        employees = employees.filter(emp => 
          emp.firstName?.toLowerCase().includes(term) ||
          emp.lastName?.toLowerCase().includes(term) ||
          emp.email?.toLowerCase().includes(term) ||
          emp.employeeId?.toLowerCase().includes(term)
        );
      }

      // Return only public profile information
      return employees.map(employee => ({
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        department: employee.department,
        jobTitle: employee.jobTitle,
        profileImage: employee.profileImage,
        phoneNumber: employee.phoneNumber,
        joinDate: employee.joinDate,
        status: employee.status
      }));
    } catch (error) {
      console.error('Error getting employee directory:', error);
      throw error;
    }
  },

  // Get user activity summary
  async getUserActivitySummary(userId, options = {}) {
    try {
      const { startDate, endDate } = options;
      const currentDate = new Date();
      const defaultStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const defaultEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const start = startDate || defaultStartDate.toISOString().split('T')[0];
      const end = endDate || defaultEndDate.toISOString().split('T')[0];

      // Get attendance records
      const attendance = await firestoreService.get('attendance', [
        where('userId', '==', userId),
        where('date', '>=', start),
        where('date', '<=', end)
      ]);

      // Get leave records
      const leaves = await firestoreService.get('leaves', [
        where('userId', '==', userId),
        where('appliedDate', '>=', new Date(start)),
        where('appliedDate', '<=', new Date(end))
      ]);

      // Get claim records
      const claims = await firestoreService.get('claims', [
        where('userId', '==', userId),
        where('submittedDate', '>=', new Date(start)),
        where('submittedDate', '<=', new Date(end))
      ]);

      // Calculate summary
      const summary = {
        period: { start, end },
        attendance: {
          totalDays: attendance.length,
          presentDays: attendance.filter(a => a.status === 'present').length,
          lateDays: attendance.filter(a => a.status === 'late').length,
          totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
          totalOvertimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0)
        },
        leaves: {
          totalApplications: leaves.length,
          approved: leaves.filter(l => l.status === 'approved').length,
          pending: leaves.filter(l => l.status === 'pending').length,
          rejected: leaves.filter(l => l.status === 'rejected').length,
          totalDaysTaken: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.totalDays || 0), 0)
        },
        claims: {
          totalSubmissions: claims.length,
          approved: claims.filter(c => c.status === 'approved').length,
          pending: claims.filter(c => c.status === 'pending').length,
          rejected: claims.filter(c => c.status === 'rejected').length,
          totalAmount: claims.reduce((sum, c) => sum + (c.amount || 0), 0),
          approvedAmount: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + (c.processedAmount || c.amount || 0), 0)
        }
      };

      return summary;
    } catch (error) {
      console.error('Error getting user activity summary:', error);
      throw error;
    }
  },

  // Update work schedule
  async updateWorkSchedule(userId, workSchedule) {
    try {
      const updateData = {
        workSchedule: {
          ...workSchedule,
          updatedAt: new Date().toISOString()
        }
      };

      await firestoreService.update('users', userId, updateData);
      return updateData.workSchedule;
    } catch (error) {
      console.error('Error updating work schedule:', error);
      throw error;
    }
  },

  // Get user performance metrics
  async getPerformanceMetrics(userId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      // Get yearly data
      const [attendance, leaves, claims] = await Promise.all([
        firestoreService.get('attendance', [
          where('userId', '==', userId),
          where('date', '>=', startOfYear.toISOString().split('T')[0]),
          where('date', '<=', endOfYear.toISOString().split('T')[0])
        ]),
        firestoreService.get('leaves', [
          where('userId', '==', userId),
          where('appliedDate', '>=', startOfYear),
          where('appliedDate', '<=', endOfYear)
        ]),
        firestoreService.get('claims', [
          where('userId', '==', userId),
          where('submittedDate', '>=', startOfYear),
          where('submittedDate', '<=', endOfYear)
        ])
      ]);

      // Calculate metrics
      const workingDays = this.calculateWorkingDays(startOfYear, endOfYear);
      const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
      const lateDays = attendance.filter(a => a.status === 'late').length;
      const approvedLeaves = leaves.filter(l => l.status === 'approved').length;

      const metrics = {
        year: currentYear,
        attendance: {
          attendanceRate: Math.round((presentDays / workingDays) * 100),
          punctualityRate: Math.round(((presentDays - lateDays) / presentDays) * 100),
          totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
          averageDailyHours: attendance.length > 0 ? 
            Math.round((attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0) / attendance.length) * 100) / 100 : 0
        },
        leaves: {
          totalTaken: approvedLeaves,
          utilizationRate: Math.round((approvedLeaves / 15) * 100), // Assuming 15 days annual leave
          averageLeaveLength: approvedLeaves > 0 ? 
            Math.round((leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.totalDays || 0), 0) / approvedLeaves) * 100) / 100 : 0
        },
        claims: {
          totalSubmitted: claims.length,
          approvalRate: claims.length > 0 ? 
            Math.round((claims.filter(c => c.status === 'approved').length / claims.length) * 100) : 0,
          averageClaimAmount: claims.length > 0 ? 
            Math.round((claims.reduce((sum, c) => sum + (c.amount || 0), 0) / claims.length) * 100) / 100 : 0
        }
      };

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  },

  // Calculate working days in a period
  calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  },

  // Update profile visibility settings
  async updatePrivacySettings(userId, privacySettings) {
    try {
      const user = await this.getProfile(userId);
      const currentSettings = user.settings || this.getDefaultSettings();
      
      const updateData = {
        settings: {
          ...currentSettings,
          privacy: {
            ...currentSettings.privacy,
            ...privacySettings
          },
          updatedAt: new Date().toISOString()
        }
      };

      await firestoreService.update('users', userId, updateData);
      return updateData.settings.privacy;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  },

  // Validate profile data
  validateProfile(profileData) {
    const errors = [];
    
    if (!profileData.firstName?.trim()) {
      errors.push('First name is required');
    }
    
    if (!profileData.lastName?.trim()) {
      errors.push('Last name is required');
    }
    
    if (profileData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.push('Invalid email format');
    }
    
    if (profileData.phoneNumber && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(profileData.phoneNumber)) {
      errors.push('Invalid phone number format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Export user data (GDPR compliance)
  async exportUserData(userId) {
    try {
      // Get all user-related data
      const [profile, attendance, leaves, claims, notifications] = await Promise.all([
        this.getProfile(userId),
        firestoreService.get('attendance', [where('userId', '==', userId)]),
        firestoreService.get('leaves', [where('userId', '==', userId)]),
        firestoreService.get('claims', [where('userId', '==', userId)]),
        firestoreService.get('notifications', [where('userId', '==', userId)])
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        profile: profile,
        attendance: attendance,
        leaves: leaves,
        claims: claims,
        notifications: notifications
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }
};