import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
// Note: Firebase Storage requires paid plan - using alternative approach

export const claimService = {
  // Submit a new claim (Free version - no file uploads)
  async submitClaim(userId, claimData, receiptImages = []) {
    try {
      // Convert images to Base64 for free storage (if small images)
      const receiptData = [];
      
      if (receiptImages.length > 0) {
        for (const file of receiptImages) {
          // Only allow small images (< 1MB) to avoid hitting Firestore limits
          if (file.size > 1024 * 1024) {
            throw new Error(`File ${file.name} is too large. Maximum size is 1MB.`);
          }
          
          const base64 = await this.fileToBase64(file);
          receiptData.push({
            name: file.name,
            data: base64,
            size: file.size,
            type: file.type
          });
        }
      }

      const claim = {
        userId,
        category: claimData.category,
        amount: parseFloat(claimData.amount),
        description: claimData.description,
        date: Timestamp.fromDate(claimData.date),
        receipts: receiptData,
        status: 'pending',
        submittedDate: Timestamp.now(),
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'claims'), claim);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Submit claim error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user's claims
  async getUserClaims(userId) {
    try {
      const q = query(
        collection(db, 'claims'),
        where('userId', '==', userId),
        orderBy('submittedDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const claims = [];
      
      querySnapshot.forEach((doc) => {
        claims.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
          submittedDate: doc.data().submittedDate?.toDate(),
          reviewedDate: doc.data().reviewedDate?.toDate()
        });
      });

      return { success: true, data: claims };
    } catch (error) {
      console.error('Get user claims error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get pending claims (for admin)
  async getPendingClaims() {
    try {
      const q = query(
        collection(db, 'claims'),
        where('status', '==', 'pending'),
        orderBy('submittedDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const claims = [];
      
      querySnapshot.forEach((doc) => {
        claims.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
          submittedDate: doc.data().submittedDate?.toDate()
        });
      });

      return { success: true, data: claims };
    } catch (error) {
      console.error('Get pending claims error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all claims (for admin)
  async getAllClaims(status = null, startDate = null, endDate = null) {
    try {
      let q = query(collection(db, 'claims'), orderBy('submittedDate', 'desc'));

      if (status) {
        q = query(
          collection(db, 'claims'),
          where('status', '==', status),
          orderBy('submittedDate', 'desc')
        );
      }

      // Note: Firestore doesn't support multiple where clauses with orderBy on different fields
      // You might need to handle date filtering client-side or create composite indexes

      const querySnapshot = await getDocs(q);
      const claims = [];
      
      querySnapshot.forEach((doc) => {
        const data = {
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
          submittedDate: doc.data().submittedDate?.toDate(),
          reviewedDate: doc.data().reviewedDate?.toDate()
        };

        // Client-side date filtering if needed
        if (startDate && endDate) {
          const submittedDate = data.submittedDate;
          if (submittedDate >= startDate && submittedDate <= endDate) {
            claims.push(data);
          }
        } else {
          claims.push(data);
        }
      });

      return { success: true, data: claims };
    } catch (error) {
      console.error('Get all claims error:', error);
      return { success: false, error: error.message };
    }
  },

  // Approve/Reject claim (admin only)
  async updateClaimStatus(claimId, status, adminId, remarks = '', approvedAmount = null) {
    try {
      const claimRef = doc(db, 'claims', claimId);
      
      const updateData = {
        status,
        reviewedBy: adminId,
        reviewedDate: Timestamp.now(),
        remarks,
        updatedAt: Timestamp.now()
      };

      if (status === 'approved' && approvedAmount !== null) {
        updateData.approvedAmount = parseFloat(approvedAmount);
      }

      await updateDoc(claimRef, updateData);
      return { success: true };
    } catch (error) {
      console.error('Update claim status error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get claim statistics
  async getClaimStatistics() {
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      const q = query(
        collection(db, 'claims'),
        where('submittedDate', '>=', Timestamp.fromDate(startOfMonth)),
        where('submittedDate', '<=', Timestamp.fromDate(endOfMonth))
      );

      const querySnapshot = await getDocs(q);
      const stats = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        approvedAmount: 0,
        byCategory: {}
      };

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        stats.total++;
        stats[data.status]++;
        stats.totalAmount += data.amount || 0;
        
        if (data.status === 'approved') {
          stats.approvedAmount += data.approvedAmount || data.amount || 0;
        }
        
        if (stats.byCategory[data.category]) {
          stats.byCategory[data.category].count++;
          stats.byCategory[data.category].amount += data.amount || 0;
        } else {
          stats.byCategory[data.category] = {
            count: 1,
            amount: data.amount || 0
          };
        }
      });

      return { success: true, data: stats };
    } catch (error) {
      console.error('Get claim statistics error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get claim categories
  getClaimCategories() {
    return [
      { id: 'transport', name: 'Transportation', description: 'Travel and commute expenses' },
      { id: 'meals', name: 'Meals & Entertainment', description: 'Business meals and entertainment' },
      { id: 'accommodation', name: 'Accommodation', description: 'Hotel and lodging expenses' },
      { id: 'office_supplies', name: 'Office Supplies', description: 'Office materials and supplies' },
      { id: 'training', name: 'Training & Development', description: 'Courses and training expenses' },
      { id: 'medical', name: 'Medical', description: 'Medical and healthcare expenses' },
      { id: 'communication', name: 'Communication', description: 'Phone and internet expenses' },
      { id: 'other', name: 'Other', description: 'Other miscellaneous expenses' }
    ];
  },

  // Get user's claim summary
  async getUserClaimSummary(userId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      const q = query(
        collection(db, 'claims'),
        where('userId', '==', userId),
        where('submittedDate', '>=', Timestamp.fromDate(startOfYear)),
        where('submittedDate', '<=', Timestamp.fromDate(endOfYear))
      );

      const querySnapshot = await getDocs(q);
      const summary = {
        totalSubmitted: 0,
        totalApproved: 0,
        totalAmount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        claimsByMonth: Array(12).fill(0).map(() => ({ count: 0, amount: 0 }))
      };

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const month = data.submittedDate.toDate().getMonth();
        
        summary.totalSubmitted++;
        summary.totalAmount += data.amount || 0;
        summary.claimsByMonth[month].count++;
        summary.claimsByMonth[month].amount += data.amount || 0;
        
        if (data.status === 'approved') {
          summary.totalApproved++;
          summary.approvedAmount += data.approvedAmount || data.amount || 0;
        } else if (data.status === 'pending') {
          summary.pendingAmount += data.amount || 0;
        }
      });

      return { success: true, data: summary };
    } catch (error) {
      console.error('Get user claim summary error:', error);
      return { success: false, error: error.message };
    }
  },

  // Helper function to convert file to Base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Helper function to create downloadable URL from Base64
  base64ToBlob(base64Data, contentType = '') {
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }
};