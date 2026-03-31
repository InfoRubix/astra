import { 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp 
} from 'firebase/firestore';
import { firestoreService, storageService } from './dataService';

/**
 * Claims Management Service
 */
export const claimsService = {
  // Submit new claim
  async submitClaim(claimData, receiptFiles = []) {
    try {
      // Convert receipt files to Base64 (free tier workaround)
      let receipts = [];
      if (receiptFiles.length > 0) {
        for (const file of receiptFiles) {
          if (file.size > 1024 * 1024) { // 1MB limit for Base64
            throw new Error(`File ${file.name} is too large. Maximum size is 1MB.`);
          }
          
          const base64 = await this.fileToBase64(file);
          receipts.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      // Create claim record
      const claimRecord = {
        ...claimData,
        receipts: receipts,
        status: 'pending',
        submittedDate: serverTimestamp(),
        receiptCount: receiptFiles.length
      };

      const claimId = await firestoreService.create('claims', claimRecord);
      
      // Send notification to admin
      await this.sendClaimNotification(claimId, 'submitted');
      
      return { id: claimId, ...claimRecord };
    } catch (error) {
      console.error('Error submitting claim:', error);
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

  // Get user claims
  async getUserClaims(userId, options = {}) {
    try {
      const { status, startDate, endDate, pageSize = 20 } = options;
      
      // Simple query to avoid composite index issues
      let queryConstraints = [
        where('userId', '==', userId)
      ];

      const claims = await firestoreService.get('claims', queryConstraints);
      
      // Client-side filtering and sorting
      let filteredClaims = claims;
      
      if (status && status !== 'all') {
        filteredClaims = filteredClaims.filter(claim => claim.status === status);
      }
      
      if (startDate) {
        const filterDate = new Date(startDate);
        filteredClaims = filteredClaims.filter(claim => {
          const claimDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
          return claimDate >= filterDate;
        });
      }
      
      if (endDate) {
        const filterDate = new Date(endDate);
        filteredClaims = filteredClaims.filter(claim => {
          const claimDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
          return claimDate <= filterDate;
        });
      }
      
      // Sort by submitted date (most recent first)
      filteredClaims.sort((a, b) => {
        const aDate = a.submittedDate?.toDate ? a.submittedDate.toDate() : new Date(a.submittedDate);
        const bDate = b.submittedDate?.toDate ? b.submittedDate.toDate() : new Date(b.submittedDate);
        return bDate - aDate;
      });
      
      // Apply pagination
      return filteredClaims.slice(0, pageSize);
    } catch (error) {
      console.error('Error getting user claims:', error);
      throw error;
    }
  },

  // Get company claims (for admin)
  async getCompanyClaims(company, options = {}) {
    try {
      const { status, department, claimType, startDate, endDate, pageSize = 50 } = options;
      
      // Simple query to avoid composite index issues
      let queryConstraints = [
        where('company', '==', company)
      ];

      const claims = await firestoreService.get('claims', queryConstraints);
      
      // Client-side filtering and sorting
      let filteredClaims = claims;
      
      if (status && status !== 'all') {
        filteredClaims = filteredClaims.filter(claim => claim.status === status);
      }
      
      if (department) {
        filteredClaims = filteredClaims.filter(claim => claim.department === department);
      }
      
      if (claimType) {
        filteredClaims = filteredClaims.filter(claim => claim.claimType === claimType);
      }
      
      if (startDate || endDate) {
        filteredClaims = filteredClaims.filter(claim => {
          const claimDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
          if (startDate && claimDate < new Date(startDate)) return false;
          if (endDate && claimDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      // Sort by submitted date (most recent first)
      filteredClaims.sort((a, b) => {
        const aDate = a.submittedDate?.toDate ? a.submittedDate.toDate() : new Date(a.submittedDate);
        const bDate = b.submittedDate?.toDate ? b.submittedDate.toDate() : new Date(b.submittedDate);
        return bDate - aDate;
      });
      
      // Apply pagination
      return filteredClaims.slice(0, pageSize);
    } catch (error) {
      console.error('Error getting company claims:', error);
      throw error;
    }
  },

  // Approve claim
  async approveClaim(claimId, adminUserId, adminName, processedAmount = null, comments = '') {
    try {
      const claim = await firestoreService.getById('claims', claimId);
      
      const updateData = {
        status: 'approved',
        approvedBy: adminName,
        approvedById: adminUserId,
        approvedDate: serverTimestamp(),
        processedAmount: processedAmount || claim.amount,
        adminComments: comments
      };

      await firestoreService.update('claims', claimId, updateData);
      
      // Send notification to user
      await this.sendClaimNotification(claimId, 'approved');
      
      
      return updateData;
    } catch (error) {
      console.error('Error approving claim:', error);
      throw error;
    }
  },

  // Reject claim
  async rejectClaim(claimId, adminUserId, adminName, reason) {
    try {
      const updateData = {
        status: 'rejected',
        rejectedBy: adminName,
        rejectedById: adminUserId,
        rejectedDate: serverTimestamp(),
        rejectionReason: reason
      };

      await firestoreService.update('claims', claimId, updateData);
      
      // Send notification to user
      await this.sendClaimNotification(claimId, 'rejected');
      
      return updateData;
    } catch (error) {
      console.error('Error rejecting claim:', error);
      throw error;
    }
  },

  // Cancel claim (by user)
  async cancelClaim(claimId, userId) {
    try {
      const claim = await firestoreService.getById('claims', claimId);
      
      if (!claim || claim.userId !== userId) {
        throw new Error('Claim not found or unauthorized');
      }

      if (claim.status !== 'pending') {
        throw new Error('Only pending claims can be cancelled');
      }

      await firestoreService.update('claims', claimId, {
        status: 'cancelled',
        cancelledDate: serverTimestamp()
      });
      
      // For Base64 storage, no need to delete files separately
      // They are stored in the document itself
      
      return true;
    } catch (error) {
      console.error('Error cancelling claim:', error);
      throw error;
    }
  },

  // Get claim categories and types
  getClaimCategories() {
    return [
      {
        type: 'travel',
        name: 'Travel & Transportation',
        categories: ['Taxi/Grab', 'Fuel', 'Parking', 'Public Transport', 'Toll', 'Car Rental'],
        maxAmount: 1000,
        requiresReceipt: true
      },
      {
        type: 'meal',
        name: 'Meals & Entertainment',
        categories: ['Client Lunch', 'Team Dinner', 'Business Meeting', 'Conference Meals'],
        maxAmount: 500,
        requiresReceipt: true
      },
      {
        type: 'accommodation',
        name: 'Hotel & Lodging',
        categories: ['Hotel Stay', 'Airbnb', 'Business Trip', 'Conference Accommodation'],
        maxAmount: 2000,
        requiresReceipt: true
      },
      {
        type: 'office',
        name: 'Office Supplies',
        categories: ['Stationery', 'Equipment', 'Software', 'Books', 'Office Furniture'],
        maxAmount: 1500,
        requiresReceipt: true
      },
      {
        type: 'communication',
        name: 'Communication',
        categories: ['Phone Bills', 'Internet', 'Postage', 'Courier', 'Conference Calls'],
        maxAmount: 300,
        requiresReceipt: true
      }
    ];
  },

  // Validate claim data
  validateClaim(claimData, receiptFiles = []) {
    const errors = [];
    
    if (!claimData.claimType) {
      errors.push('Claim type is required');
    }
    
    if (!claimData.category) {
      errors.push('Category is required');
    }
    
    if (!claimData.amount || claimData.amount <= 0) {
      errors.push('Valid amount is required');
    }
    
    if (!claimData.description?.trim()) {
      errors.push('Description is required');
    }
    
    if (!claimData.location?.trim()) {
      errors.push('Location is required');
    }
    
    if (!claimData.claimDate) {
      errors.push('Claim date is required');
    }

    // Check if receipts are required
    const category = this.getClaimCategories().find(c => c.type === claimData.claimType);
    if (category?.requiresReceipt && receiptFiles.length === 0) {
      errors.push('Receipt is required for this claim type');
    }

    // Check maximum amount
    if (category && claimData.amount > category.maxAmount) {
      errors.push(`Amount exceeds maximum limit of ${category.maxAmount} for ${category.name}`);
    }

    // Check claim date (not older than 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (new Date(claimData.claimDate) < threeMonthsAgo) {
      errors.push('Claims cannot be submitted for expenses older than 3 months');
    }

    return errors;
  },

  // Get claims statistics
  async getClaimsStatistics(company, options = {}) {
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
          where('submittedDate', '>=', startDate),
          where('submittedDate', '<=', endDate)
        );
      }

      const claims = await firestoreService.get('claims', queryConstraints);
      
      // Calculate statistics
      const stats = {
        total: claims.length,
        pending: claims.filter(c => c.status === 'pending').length,
        approved: claims.filter(c => c.status === 'approved').length,
        rejected: claims.filter(c => c.status === 'rejected').length,
        totalAmount: claims.reduce((sum, c) => sum + (c.amount || 0), 0),
        approvedAmount: claims.filter(c => c.status === 'approved')
                             .reduce((sum, c) => sum + (c.processedAmount || c.amount || 0), 0),
        byType: {},
        byDepartment: {},
        byCategory: {}
      };

      claims.forEach(claim => {
        // By type
        stats.byType[claim.claimType] = (stats.byType[claim.claimType] || 0) + 1;
        
        // By department
        stats.byDepartment[claim.department] = (stats.byDepartment[claim.department] || 0) + 1;
        
        // By category
        stats.byCategory[claim.category] = (stats.byCategory[claim.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting claims statistics:', error);
      throw error;
    }
  },

  // Send claim notification
  async sendClaimNotification(claimId, status) {
    try {
      const claim = await firestoreService.getById('claims', claimId);
      
      if (claim) {
        const notification = {
          userId: claim.userId,
          type: 'claim_update',
          title: `Claim ${status}`,
          message: `Your ${claim.category} claim (${claim.currency} ${claim.amount}) has been ${status}`,
          claimId: claimId,
          read: false,
          createdAt: serverTimestamp()
        };
        
        await firestoreService.create('notifications', notification);
      }
    } catch (error) {
      console.error('Error sending claim notification:', error);
    }
  },


  // Listen to user claims (real-time)
  listenToUserClaims(userId, callback) {
    return firestoreService.listen('claims', [
      where('userId', '==', userId),
      orderBy('submittedDate', 'desc')
    ], callback);
  },

  // Listen to company claims (real-time for admin)
  listenToCompanyClaims(company, callback) {
    return firestoreService.listen('claims', [
      where('company', '==', company),
      orderBy('submittedDate', 'desc'),
      limit(100) // Limit for performance
    ], callback);
  },

  // Generate claim report
  async generateClaimReport(company, options = {}) {
    try {
      const { startDate, endDate, format = 'summary' } = options;
      
      const claims = await this.getCompanyClaims(company, { 
        startDate, 
        endDate, 
        pageSize: 1000 
      });

      if (format === 'summary') {
        return this.getClaimsStatistics(company, options);
      } else {
        // Detailed report
        return {
          period: { startDate, endDate },
          totalClaims: claims.length,
          claims: claims.map(claim => ({
            id: claim.id,
            employee: claim.userName,
            department: claim.department,
            type: claim.claimType,
            category: claim.category,
            amount: claim.amount,
            status: claim.status,
            submittedDate: claim.submittedDate,
            approvedAmount: claim.processedAmount
          }))
        };
      }
    } catch (error) {
      console.error('Error generating claim report:', error);
      throw error;
    }
  }
};