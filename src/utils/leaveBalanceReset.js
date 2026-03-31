// Leave Balance Reset Utility
// This utility handles automatic leave balance resets for new year

import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// Leave balance configuration for different years
export const getLeaveBalanceConfig = (year, userRole = 'user', companyPolicy = 'default') => {
  const configs = {
    default: {
      annual: 12,      // 12 days per year
      sick: 14,        // 14 days per year  
      emergency: 3,    // 3 days per year
      maternity: 90    // 90 days per year (includes paternity)
    },
    senior: {
      annual: 18,      // Senior staff get more annual leave
      sick: 14,
      emergency: 5,    // More emergency days
      maternity: 90
    },
    executive: {
      annual: 21,      // Executives get even more
      sick: 14,
      emergency: 7,
      maternity: 90
    }
  };

  // Year-specific adjustments
  const yearAdjustments = {
    2026: {
      annual: 15,      // Company-wide increase in 2026
      sick: 14,
      emergency: 3,
      maternity: 90
    },
    2027: {
      annual: 16,      // Gradual increase over years
      sick: 15,
      emergency: 4,
      maternity: 120   // Extended maternity leave
    }
  };

  // Get base config
  let baseConfig = configs[companyPolicy] || configs.default;
  
  // Apply year-specific adjustments
  if (yearAdjustments[year]) {
    baseConfig = { ...baseConfig, ...yearAdjustments[year] };
  }

  return baseConfig;
};

// Check if it's time for annual reset (called on app load)
export const checkAnnualLeaveReset = (userId) => {
  const currentYear = new Date().getFullYear();
  const lastResetYear = localStorage.getItem(`leaveReset_${userId}`);
  
  if (!lastResetYear || parseInt(lastResetYear) < currentYear) {
    // It's a new year, mark as reset needed
    localStorage.setItem(`leaveReset_${userId}`, currentYear.toString());
    return {
      isNewYear: true,
      currentYear,
      lastResetYear: parseInt(lastResetYear) || currentYear - 1
    };
  }
  
  return { isNewYear: false, currentYear };
};

// Admin function to manually reset all users' leave balances
export const adminResetAllLeaveBalances = async (companyName, targetYear = null) => {
  try {
    const year = targetYear || new Date().getFullYear();
    
    // Get all users in the company
    const usersQuery = collection(db, 'users');
    const usersSnapshot = await getDocs(usersQuery);
    
    const resetPromises = [];
    
    usersSnapshot.docs.forEach(userDoc => {
      const userData = userDoc.data();
      
      // Only reset for users in the same company
      if (userData.companyName === companyName) {
        const userId = userDoc.id;
        const userRole = userData.role || 'user';
        const leaveConfig = getLeaveBalanceConfig(year, userRole);
        
        // Create leave balance reset record
        const resetRecord = {
          userId,
          userName: `${userData.firstName} ${userData.lastName}`,
          companyName,
          year,
          resetDate: serverTimestamp(),
          balances: leaveConfig,
          resetBy: 'admin',
          resetType: 'annual'
        };
        
        resetPromises.push(
          setDoc(doc(db, 'leaveBalanceResets', `${userId}_${year}`), resetRecord)
        );
      }
    });
    
    await Promise.all(resetPromises);
    
    console.log(`Successfully reset leave balances for ${resetPromises.length} users in ${companyName} for year ${year}`);
    
    return {
      success: true,
      usersReset: resetPromises.length,
      year,
      companyName
    };
    
  } catch (error) {
    console.error('Error resetting leave balances:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get leave balance history for audit purposes
export const getLeaveBalanceHistory = async (userId) => {
  try {
    const historyQuery = collection(db, 'leaveBalanceResets');
    const historySnapshot = await getDocs(historyQuery);
    
    const userHistory = historySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(record => record.userId === userId)
      .sort((a, b) => b.year - a.year);
    
    return userHistory;
  } catch (error) {
    console.error('Error loading leave balance history:', error);
    return [];
  }
};

// Validate if user has sufficient leave balance
export const validateLeaveBalance = (leaveType, requestedDays, currentBalance) => {
  const available = currentBalance.total - currentBalance.used;
  
  if (requestedDays > available) {
    return {
      valid: false,
      message: `Insufficient ${leaveType} leave balance. Available: ${available} days, Requested: ${requestedDays} days`,
      available,
      requested: requestedDays
    };
  }
  
  return {
    valid: true,
    message: 'Leave balance is sufficient',
    available,
    requested: requestedDays
  };
};

// Calculate leave entitlement based on employment duration
export const calculateProRatedLeave = (startDate, leaveConfig, targetYear = null) => {
  const year = targetYear || new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const employmentStart = new Date(startDate);
  
  // If employee started before the year, they get full entitlement
  if (employmentStart < yearStart) {
    return leaveConfig;
  }
  
  // Calculate pro-rated entitlement based on remaining months
  const monthsRemaining = 12 - employmentStart.getMonth();
  const proRatio = monthsRemaining / 12;
  
  const proRatedConfig = {};
  Object.keys(leaveConfig).forEach(leaveType => {
    proRatedConfig[leaveType] = Math.floor(leaveConfig[leaveType] * proRatio);
  });
  
  return proRatedConfig;
};

export default {
  getLeaveBalanceConfig,
  checkAnnualLeaveReset,
  adminResetAllLeaveBalances,
  getLeaveBalanceHistory,
  validateLeaveBalance,
  calculateProRatedLeave
};