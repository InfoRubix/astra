import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { leaveService } from '../services/leaveService';
import { claimsService } from '../services/claimsService';

export const useBranchDashboard = (user) => {
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    pendingClaims: 0,
    branchInfo: null,
    employees: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get branch name from user data
  const getBranchName = () => {
    return user?.branchName || user?.branch || 'Branch';
  };

  useEffect(() => {
    if (!user?.company || user?.role !== 'branch_admin') {
      setLoading(false);
      return;
    }

    const fetchBranchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const branchName = getBranchName();

        // Fetch employees from this branch
        const employeesQuery = query(
          collection(db, 'users'),
          where('company', '==', user.company)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const allEmployees = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter employees for this branch
        const branchEmployees = allEmployees.filter(emp => 
          emp.branchName === branchName || 
          emp.branch === branchName ||
          emp.branchId === user.branchId
        );

        console.log('🏢 Branch Dashboard - All employees:', allEmployees.length, 'Branch employees:', branchEmployees.length);

        // Get branch-specific leaves
        const branchEmployeeIds = branchEmployees.map(emp => emp.uid).filter(Boolean);
        let branchLeaves = [];
        let branchClaims = [];

        if (branchEmployeeIds.length > 0) {
          // Fetch leaves for branch employees
          try {
            const allLeaves = await leaveService.getCompanyLeaves(user.company);
            branchLeaves = allLeaves.filter(leave => 
              branchEmployeeIds.includes(leave.userId)
            );
            console.log('🏢 Branch Dashboard - Branch leaves:', branchLeaves.length);
          } catch (leaveError) {
            console.warn('Could not fetch leaves:', leaveError);
          }

          // Fetch claims for branch employees
          try {
            const allClaims = await claimsService.getCompanyClaims(user.company);
            branchClaims = allClaims.filter(claim => 
              branchEmployeeIds.includes(claim.userId)
            );
            console.log('🏢 Branch Dashboard - Branch claims:', branchClaims.length);
          } catch (claimError) {
            console.warn('Could not fetch claims:', claimError);
          }
        }

        // Calculate statistics
        const pendingLeaves = branchLeaves.filter(leave => leave.status === 'pending');
        const pendingClaims = branchClaims.filter(claim => claim.status === 'pending');

        // Query real attendance for today
        let presentToday = 0;
        try {
          const todayString = new Date().toISOString().split('T')[0];
          const attendanceQuery = query(
            collection(db, 'attendance'),
            where('dateString', '==', todayString)
          );
          const attendanceSnap = await getDocs(attendanceQuery);
          const todayRecords = attendanceSnap.docs.map(d => d.data());
          presentToday = todayRecords.filter(r => branchEmployeeIds.includes(r.userId)).length;
        } catch (attendanceError) {
          console.warn('Could not fetch today attendance:', attendanceError);
        }

        // Generate recent activity
        const recentActivity = [
          ...pendingLeaves.slice(0, 3).map(leave => ({
            id: leave.id,
            type: 'leave',
            message: `${leave.userName || 'Employee'} submitted ${leave.type} leave request`,
            time: leave.createdAt,
            status: leave.status
          })),
          ...pendingClaims.slice(0, 3).map(claim => ({
            id: claim.id,
            type: 'claim',
            message: `${claim.userName || 'Employee'} submitted expense claim (RM ${claim.amount})`,
            time: claim.createdAt,
            status: claim.status
          }))
        ].sort((a, b) => {
          // Sort by timestamp if available
          if (a.time && b.time) {
            const aTime = a.time.seconds ? a.time.seconds : new Date(a.time).getTime() / 1000;
            const bTime = b.time.seconds ? b.time.seconds : new Date(b.time).getTime() / 1000;
            return bTime - aTime;
          }
          return 0;
        }).slice(0, 5);

        setDashboardData({
          totalEmployees: branchEmployees.length,
          presentToday,
          pendingLeaves: pendingLeaves.length,
          pendingClaims: pendingClaims.length,
          branchInfo: {
            name: branchName,
            company: user.company
          },
          employees: branchEmployees,
          recentActivity
        });

      } catch (err) {
        console.error('Error fetching branch dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranchDashboardData();

    // Set up real-time listeners for leaves and claims
    const branchName = getBranchName();
    const branchEmployees = [];

    // First get employees, then set up listeners
    const setupListeners = async () => {
      try {
        const employeesQuery = query(
          collection(db, 'users'),
          where('company', '==', user.company)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const allEmployees = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const branchEmployees = allEmployees.filter(emp => 
          emp.branchName === branchName || 
          emp.branch === branchName ||
          emp.branchId === user.branchId
        );

        const branchEmployeeIds = branchEmployees.map(emp => emp.uid).filter(Boolean);

        if (branchEmployeeIds.length === 0) return () => {};

        // Listen to leaves
        const unsubscribeLeaves = onSnapshot(
          query(
            collection(db, 'leaves'),
            where('company', '==', user.company)
          ),
          (snapshot) => {
            const leaves = snapshot.docs.map(doc => doc.data());
            const branchLeaves = leaves.filter(leave => 
              branchEmployeeIds.includes(leave.userId)
            );
            const pendingLeaves = branchLeaves.filter(leave => leave.status === 'pending');
            
            setDashboardData(prev => ({
              ...prev,
              pendingLeaves: pendingLeaves.length
            }));
          }
        );

        // Listen to claims
        const unsubscribeClaims = onSnapshot(
          query(
            collection(db, 'claims'),
            where('company', '==', user.company)
          ),
          (snapshot) => {
            const claims = snapshot.docs.map(doc => doc.data());
            const branchClaims = claims.filter(claim => 
              branchEmployeeIds.includes(claim.userId)
            );
            const pendingClaims = branchClaims.filter(claim => claim.status === 'pending');
            
            setDashboardData(prev => ({
              ...prev,
              pendingClaims: pendingClaims.length
            }));
          }
        );

        return () => {
          unsubscribeLeaves();
          unsubscribeClaims();
        };
      } catch (error) {
        console.error('Error setting up listeners:', error);
        return () => {};
      }
    };

    let unsubscribeListeners = () => {};
    setupListeners().then(unsub => {
      unsubscribeListeners = unsub;
    });

    return () => unsubscribeListeners();
  }, [user?.company, user?.branchId, user?.role]);

  return {
    dashboardData,
    loading,
    error,
    branchName: getBranchName()
  };
};