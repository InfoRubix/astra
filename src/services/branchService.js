import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export const branchService = {
  // Get all branches for a company
  async getBranches(companyName, options = {}) {
    try {
      let branchQuery = query(
        collection(db, 'branches'),
        where('companyName', '==', companyName)
      );

      // Add ordering if no index issues
      if (!options.skipOrdering) {
        branchQuery = query(branchQuery, orderBy('name'));
      }

      const snapshot = await getDocs(branchQuery);
      const branches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('🏢 Branch Service - Fetched branches for company:', companyName, '- Count:', branches.length);
      return branches;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  },

  // Get single branch by ID
  async getBranch(branchId) {
    try {
      const branchDoc = await getDoc(doc(db, 'branches', branchId));
      if (branchDoc.exists()) {
        return {
          id: branchDoc.id,
          ...branchDoc.data()
        };
      } else {
        throw new Error('Branch not found');
      }
    } catch (error) {
      console.error('Error fetching branch:', error);
      throw error;
    }
  },

  // Create new branch
  async createBranch(branchData) {
    try {
      const newBranch = {
        ...branchData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      };

      const docRef = await addDoc(collection(db, 'branches'), newBranch);
      console.log('🏢 Branch Service - Created branch:', docRef.id);
      
      return {
        id: docRef.id,
        ...newBranch
      };
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  },

  // Update branch
  async updateBranch(branchId, updateData) {
    try {
      const updatedData = {
        ...updateData,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'branches', branchId), updatedData);
      console.log('🏢 Branch Service - Updated branch:', branchId);
      
      return await this.getBranch(branchId);
    } catch (error) {
      console.error('Error updating branch:', error);
      throw error;
    }
  },

  // Delete branch
  async deleteBranch(branchId) {
    try {
      await deleteDoc(doc(db, 'branches', branchId));
      console.log('🏢 Branch Service - Deleted branch:', branchId);
      return true;
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  },

  // Get branch statistics
  async getBranchStatistics(companyName, branchId = null) {
    try {
      // Get employees for the company
      let employeesQuery = query(
        collection(db, 'users'),
        where('company', '==', companyName)
      );

      const employeesSnapshot = await getDocs(employeesQuery);
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If specific branch requested, filter employees
      let branchEmployees = employees;
      if (branchId) {
        const branch = await this.getBranch(branchId);
        branchEmployees = employees.filter(emp => 
          emp.branchName === branch.name || 
          emp.branch === branch.name ||
          emp.branchId === branchId
        );
      }

      // Get leave requests
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('company', '==', companyName)
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const leaves = leavesSnapshot.docs.map(doc => doc.data());

      // Get claims
      const claimsQuery = query(
        collection(db, 'claims'),
        where('company', '==', companyName)
      );
      const claimsSnapshot = await getDocs(claimsQuery);
      const claims = claimsSnapshot.docs.map(doc => doc.data());

      // Calculate statistics
      const branchEmployeeIds = branchEmployees.map(emp => emp.uid);
      const branchLeaves = leaves.filter(leave => 
        branchEmployeeIds.includes(leave.userId)
      );
      const branchClaims = claims.filter(claim => 
        branchEmployeeIds.includes(claim.userId)
      );

      return {
        totalEmployees: branchEmployees.length,
        pendingLeaves: branchLeaves.filter(leave => leave.status === 'pending').length,
        approvedLeaves: branchLeaves.filter(leave => leave.status === 'approved').length,
        pendingClaims: branchClaims.filter(claim => claim.status === 'pending').length,
        approvedClaims: branchClaims.filter(claim => claim.status === 'approved').length,
        employees: branchEmployees,
        leaves: branchLeaves,
        claims: branchClaims
      };
    } catch (error) {
      console.error('Error fetching branch statistics:', error);
      throw error;
    }
  },

  // Get branches with employee counts
  async getBranchesWithStats(companyName) {
    try {
      const branches = await this.getBranches(companyName, { skipOrdering: true });
      
      // Get all employees for the company
      const employeesQuery = query(
        collection(db, 'users'),
        where('company', '==', companyName)
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate stats for each branch
      const branchesWithStats = branches.map(branch => {
        const branchEmployees = employees.filter(emp => 
          emp.branchName === branch.name || 
          emp.branch === branch.name ||
          emp.branchId === branch.id
        );

        return {
          ...branch,
          employeeCount: branchEmployees.length,
          employees: branchEmployees
        };
      });

      return branchesWithStats;
    } catch (error) {
      console.error('Error fetching branches with stats:', error);
      throw error;
    }
  },

  // Real-time listener for branches
  onBranchesChange(companyName, callback) {
    const branchesQuery = query(
      collection(db, 'branches'),
      where('companyName', '==', companyName)
    );

    return onSnapshot(branchesQuery, (snapshot) => {
      const branches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(branches);
    });
  },

  // Search branches
  async searchBranches(companyName, searchTerm) {
    try {
      const branches = await this.getBranches(companyName, { skipOrdering: true });
      
      if (!searchTerm) return branches;

      const searchLower = searchTerm.toLowerCase();
      return branches.filter(branch => 
        branch.name?.toLowerCase().includes(searchLower) ||
        branch.location?.toLowerCase().includes(searchLower) ||
        branch.address?.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Error searching branches:', error);
      throw error;
    }
  }
};