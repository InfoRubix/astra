import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { leaveService } from '../services/leaveService';
import { claimsService } from '../services/claimsService';

export const useCompanyDashboard = (company) => {
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    activeBranches: 0,
    pendingLeaves: 0,
    pendingClaims: 0,
    branches: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch total employees
        const employeesQuery = query(
          collection(db, 'users'),
          where('company', '==', company)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const employees = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch branches directly from branches collection
        const branchesQuery = query(
          collection(db, 'branches'),
          where('companyName', '==', company)
          // orderBy('name') - Temporarily removed to avoid index requirement
        );
        const branchesSnapshot = await getDocs(branchesQuery);
        const branches = branchesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('📋 Dashboard - Direct branch query for company:', company, '- Branches found:', branches.length);
        
        // Fetch pending leaves using existing service
        const leaves = await leaveService.getCompanyLeaves(company, { status: 'pending' });
        const pendingLeaves = leaves.filter(leave => leave.status === 'pending');
        console.log('📋 Company Dashboard - Leaves for company:', company, '- Total leaves:', leaves.length, '- Pending:', pendingLeaves.length);

        // Fetch pending claims using existing service
        const claims = await claimsService.getCompanyClaims(company, { status: 'pending' });
        const pendingClaims = claims.filter(claim => claim.status === 'pending');
        console.log('📋 Company Dashboard - Claims for company:', company, '- Total claims:', claims.length, '- Pending:', pendingClaims.length);

        // Calculate branch statistics
        const branchStats = branches.map(branch => {
          // Match employees to branch using multiple field combinations for compatibility
          const branchEmployees = employees.filter(emp => 
            emp.branchName === branch.name || 
            emp.branch === branch.name ||
            emp.branchId === branch.id
          );
          
          const branchLeaves = pendingLeaves.filter(leave => 
            branchEmployees.some(emp => emp.uid === leave.userId)
          );

          return {
            id: branch.id,
            name: branch.name,
            employeeCount: branchEmployees.length,
            pendingLeaves: branchLeaves.length
          };
        });

        setDashboardData({
          totalEmployees: employees.length,
          activeBranches: branches.length,
          pendingLeaves: pendingLeaves.length,
          pendingClaims: pendingClaims.length,
          branches: branchStats
        });

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Set up real-time listeners for dynamic updates
    const unsubscribeLeaves = onSnapshot(
      query(
        collection(db, 'leaves'),
        where('company', '==', company)
      ),
      (snapshot) => {
        const pendingLeaves = snapshot.docs
          .map(doc => doc.data())
          .filter(leave => leave.status === 'pending');
        
        setDashboardData(prev => ({
          ...prev,
          pendingLeaves: pendingLeaves.length
        }));
      }
    );

    const unsubscribeClaims = onSnapshot(
      query(
        collection(db, 'claims'),
        where('company', '==', company)
      ),
      (snapshot) => {
        const pendingClaims = snapshot.docs
          .map(doc => doc.data())
          .filter(claim => claim.status === 'pending');
        
        setDashboardData(prev => ({
          ...prev,
          pendingClaims: pendingClaims.length
        }));
      }
    );

    // Add real-time listener for branches
    const unsubscribeBranches = onSnapshot(
      query(
        collection(db, 'branches'),
        where('companyName', '==', company)
      ),
      (snapshot) => {
        const branches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('📋 Dashboard - Real-time branch update for company:', company, '- Branches:', branches.length);
        
        setDashboardData(prev => ({
          ...prev,
          activeBranches: branches.length,
          branches: branches.map(branch => ({
            id: branch.id,
            name: branch.name,
            employeeCount: 0, // Will be updated when employees change
            pendingLeaves: 0
          }))
        }));
      }
    );

    return () => {
      unsubscribeLeaves();
      unsubscribeClaims();
      unsubscribeBranches();
    };
  }, [company, refetchTrigger]);

  return {
    dashboardData,
    loading,
    error,
    refetch: () => {
      if (company) {
        setRefetchTrigger(prev => prev + 1);
      }
    }
  };
};