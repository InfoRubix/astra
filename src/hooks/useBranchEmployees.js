import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../services/firebase';

export const useBranchEmployees = (user) => {
  const [employees, setEmployees] = useState([]);
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

    const fetchBranchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);

        const branchName = getBranchName();

        // Fetch all company employees
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
        const branchEmployees = allEmployees.filter(emp => {
          // Check multiple possible branch field combinations for compatibility
          return emp.branchName === branchName || 
                 emp.branch === branchName ||
                 emp.branchId === user.branchId ||
                 (emp.branchName && emp.branchName.includes(branchName)) ||
                 (emp.branch && emp.branch.includes(branchName));
        });

        console.log('🏢 Branch Employees - Total company employees:', allEmployees.length);
        console.log('🏢 Branch Employees - Branch employees:', branchEmployees.length);
        console.log('🏢 Branch Employees - Branch name:', branchName);

        setEmployees(branchEmployees);

      } catch (err) {
        console.error('Error fetching branch employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranchEmployees();

    // Set up real-time listener
    const branchName = getBranchName();
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'users'),
        where('company', '==', user.company)
      ),
      (snapshot) => {
        const allEmployees = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter for branch employees
        const branchEmployees = allEmployees.filter(emp => {
          return emp.branchName === branchName || 
                 emp.branch === branchName ||
                 emp.branchId === user.branchId ||
                 (emp.branchName && emp.branchName.includes(branchName)) ||
                 (emp.branch && emp.branch.includes(branchName));
        });

        setEmployees(branchEmployees);
        console.log('🏢 Branch Employees - Real-time update:', branchEmployees.length);
      },
      (err) => {
        console.error('Error in real-time employee listener:', err);
        setError(err.message);
      }
    );

    return () => unsubscribe();
  }, [user?.company, user?.branchId, user?.role]);

  return {
    employees,
    loading,
    error,
    branchName: getBranchName(),
    refetch: () => {
      // Trigger re-fetch by updating loading state
      setLoading(true);
    }
  };
};