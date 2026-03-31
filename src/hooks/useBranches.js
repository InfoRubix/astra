import { useState, useEffect, useCallback } from 'react';
import { branchService } from '../services/branchService';

export const useBranches = (companyName) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch branches with statistics
  const fetchBranches = useCallback(async () => {
    if (!companyName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const branchesWithStats = await branchService.getBranchesWithStats(companyName);
      setBranches(branchesWithStats);
      
      console.log('🏢 useBranches - Fetched branches for company:', companyName, '- Count:', branchesWithStats.length);
    } catch (err) {
      console.error('Error in useBranches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyName]);

  // Initial fetch
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Set up real-time listener
  useEffect(() => {
    if (!companyName) return;

    const unsubscribe = branchService.onBranchesChange(companyName, async (updatedBranches) => {
      try {
        // Re-fetch with stats when branches change
        const branchesWithStats = await branchService.getBranchesWithStats(companyName);
        setBranches(branchesWithStats);
        console.log('🏢 useBranches - Real-time update for company:', companyName, '- Count:', branchesWithStats.length);
      } catch (err) {
        console.error('Error in real-time branch update:', err);
        setError(err.message);
      }
    });

    return () => unsubscribe();
  }, [companyName]);

  return {
    branches,
    loading,
    error,
    refetch: fetchBranches
  };
};

export const useBranchDetails = (branchId) => {
  const [branch, setBranch] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBranchDetails = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [branchData, stats] = await Promise.all([
        branchService.getBranch(branchId),
        branchService.getBranchStatistics(null, branchId)
      ]);

      setBranch(branchData);
      setStatistics(stats);
    } catch (err) {
      console.error('Error fetching branch details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchBranchDetails();
  }, [fetchBranchDetails]);

  return {
    branch,
    statistics,
    loading,
    error,
    refetch: fetchBranchDetails
  };
};

export const useBranchOperations = () => {
  const [operationLoading, setOperationLoading] = useState(false);
  const [operationError, setOperationError] = useState(null);

  const createBranch = async (branchData) => {
    try {
      setOperationLoading(true);
      setOperationError(null);
      
      const newBranch = await branchService.createBranch(branchData);
      console.log('🏢 Created new branch:', newBranch.id);
      return newBranch;
    } catch (err) {
      console.error('Error creating branch:', err);
      setOperationError(err.message);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  };

  const updateBranch = async (branchId, updateData) => {
    try {
      setOperationLoading(true);
      setOperationError(null);
      
      const updatedBranch = await branchService.updateBranch(branchId, updateData);
      console.log('🏢 Updated branch:', branchId);
      return updatedBranch;
    } catch (err) {
      console.error('Error updating branch:', err);
      setOperationError(err.message);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  };

  const deleteBranch = async (branchId) => {
    try {
      setOperationLoading(true);
      setOperationError(null);
      
      await branchService.deleteBranch(branchId);
      console.log('🏢 Deleted branch:', branchId);
      return true;
    } catch (err) {
      console.error('Error deleting branch:', err);
      setOperationError(err.message);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  };

  const searchBranches = async (companyName, searchTerm) => {
    try {
      setOperationLoading(true);
      setOperationError(null);
      
      const results = await branchService.searchBranches(companyName, searchTerm);
      return results;
    } catch (err) {
      console.error('Error searching branches:', err);
      setOperationError(err.message);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  };

  return {
    createBranch,
    updateBranch,
    deleteBranch,
    searchBranches,
    operationLoading,
    operationError
  };
};