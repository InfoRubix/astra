import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format, startOfMonth, endOfMonth, differenceInMinutes, parseISO, isWeekend, getDay } from 'date-fns';

/**
 * Standard work configuration
 */
const WORK_CONFIG = {
  standardWorkHours: 8, // 8 hours per day
  standardWorkDays: 5, // Monday to Friday
  workStartTime: '09:00', // 9:00 AM
  workEndTime: '18:00', // 6:00 PM
  lunchBreakMinutes: 60, // 1 hour lunch break
  overtimeThreshold: 8, // Overtime after 8 hours
  weekendOvertimeMultiplier: 2.0, // Double pay for weekends
  holidayOvertimeMultiplier: 2.5, // 2.5x pay for holidays
  maxOvertimePerDay: 4, // Maximum 4 hours overtime per day
  lateThresholdMinutes: 15, // Late if more than 15 minutes
  earlyLeaveThresholdMinutes: 15 // Early leave if more than 15 minutes
};

/**
 * Load attendance data for an employee in a specific month
 */
export const loadEmployeeAttendanceForMonth = async (employeeId, year, month) => {
  try {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    
    console.log(`📅 Loading attendance for employee ${employeeId} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
    
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', employeeId),
      where('date', '>=', format(startDate, 'yyyy-MM-dd')),
      where('date', '<=', format(endDate, 'yyyy-MM-dd')),
      orderBy('date', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const attendanceRecords = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 Found ${attendanceRecords.length} attendance records`);
    return attendanceRecords;
  } catch (error) {
    console.error('Error loading attendance data:', error);
    return [];
  }
};

/**
 * Calculate time difference in hours
 */
const calculateTimeDifferenceInHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  try {
    // Handle both date strings and time strings
    let start, end;
    
    if (startTime.includes('T') || startTime.includes(' ')) {
      // Full datetime
      start = new Date(startTime);
      end = new Date(endTime);
    } else {
      // Time only (HH:mm format)
      const today = new Date().toISOString().split('T')[0];
      start = new Date(`${today}T${startTime}:00`);
      end = new Date(`${today}T${endTime}:00`);
      
      // Handle case where end time is next day (e.g., night shift)
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }
    }
    
    const diffMinutes = differenceInMinutes(end, start);
    return Math.max(0, diffMinutes / 60);
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return 0;
  }
};

/**
 * Calculate daily work summary
 */
export const calculateDailyWorkSummary = (attendanceRecord) => {
  const { checkIn, checkOut, date, status } = attendanceRecord;
  
  // Handle different status types
  if (status === 'absent') {
    return {
      date,
      status: 'absent',
      hoursWorked: 0,
      overtimeHours: 0,
      isLate: false,
      isEarlyLeave: false,
      workingHours: 0,
      breakTime: 0
    };
  }
  
  if (status === 'leave' || !checkIn) {
    return {
      date,
      status: status || 'leave',
      hoursWorked: 0,
      overtimeHours: 0,
      isLate: false,
      isEarlyLeave: false,
      workingHours: 0,
      breakTime: 0
    };
  }
  
  const totalHours = calculateTimeDifferenceInHours(checkIn, checkOut || new Date().toISOString());
  const effectiveHours = Math.max(0, totalHours - (WORK_CONFIG.lunchBreakMinutes / 60));
  
  // Calculate lateness
  const standardStart = new Date(`${date}T${WORK_CONFIG.workStartTime}:00`);
  const actualStart = new Date(checkIn.includes('T') ? checkIn : `${date}T${checkIn}:00`);
  const lateMinutes = Math.max(0, differenceInMinutes(actualStart, standardStart));
  const isLate = lateMinutes > WORK_CONFIG.lateThresholdMinutes;
  
  // Calculate early leave
  let isEarlyLeave = false;
  if (checkOut) {
    const standardEnd = new Date(`${date}T${WORK_CONFIG.workEndTime}:00`);
    const actualEnd = new Date(checkOut.includes('T') ? checkOut : `${date}T${checkOut}:00`);
    const earlyMinutes = Math.max(0, differenceInMinutes(standardEnd, actualEnd));
    isEarlyLeave = earlyMinutes > WORK_CONFIG.earlyLeaveThresholdMinutes;
  }
  
  // Calculate overtime
  const regularHours = Math.min(effectiveHours, WORK_CONFIG.standardWorkHours);
  const overtimeHours = Math.max(0, Math.min(effectiveHours - WORK_CONFIG.standardWorkHours, WORK_CONFIG.maxOvertimePerDay));
  
  // Check if weekend
  const dateObj = new Date(date);
  const isWeekendDay = isWeekend(dateObj);
  
  return {
    date,
    status: 'present',
    checkIn,
    checkOut,
    totalHours: totalHours.toFixed(2),
    hoursWorked: regularHours.toFixed(2),
    effectiveHours: effectiveHours.toFixed(2),
    overtimeHours: overtimeHours.toFixed(2),
    isLate,
    isEarlyLeave,
    lateMinutes,
    isWeekend: isWeekendDay,
    workingHours: effectiveHours,
    breakTime: WORK_CONFIG.lunchBreakMinutes / 60
  };
};

/**
 * Calculate monthly attendance summary
 */
export const calculateMonthlyAttendanceSummary = (attendanceRecords) => {
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalWeekendHours = 0;
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  let daysEarlyLeave = 0;
  let totalLateMinutes = 0;
  
  const dailySummaries = attendanceRecords.map(record => {
    const summary = calculateDailyWorkSummary(record);
    
    if (summary.status === 'present') {
      daysPresent++;
      totalRegularHours += parseFloat(summary.hoursWorked);
      totalOvertimeHours += parseFloat(summary.overtimeHours);
      
      if (summary.isWeekend) {
        totalWeekendHours += parseFloat(summary.effectiveHours);
      }
      
      if (summary.isLate) {
        daysLate++;
        totalLateMinutes += summary.lateMinutes || 0;
      }
      
      if (summary.isEarlyLeave) {
        daysEarlyLeave++;
      }
    } else if (summary.status === 'absent') {
      daysAbsent++;
    }
    
    return summary;
  });
  
  return {
    dailySummaries,
    summary: {
      totalRegularHours: totalRegularHours.toFixed(2),
      totalOvertimeHours: totalOvertimeHours.toFixed(2),
      totalWeekendHours: totalWeekendHours.toFixed(2),
      totalHours: (totalRegularHours + totalOvertimeHours).toFixed(2),
      daysPresent,
      daysAbsent,
      daysLate,
      daysEarlyLeave,
      totalLateMinutes,
      attendanceRate: attendanceRecords.length > 0 ? ((daysPresent / attendanceRecords.length) * 100).toFixed(1) : 0,
      averageHoursPerDay: daysPresent > 0 ? (totalRegularHours / daysPresent).toFixed(2) : 0
    }
  };
};

/**
 * Calculate overtime pay based on different rates
 */
export const calculateOvertimePay = (overtimeHours, weekendHours, hourlyRate, holidayHours = 0) => {
  const regularOvertimePay = parseFloat(overtimeHours) * hourlyRate * 1.5; // 1.5x for regular overtime
  const weekendOvertimePay = parseFloat(weekendHours) * hourlyRate * WORK_CONFIG.weekendOvertimeMultiplier;
  const holidayOvertimePay = parseFloat(holidayHours) * hourlyRate * WORK_CONFIG.holidayOvertimeMultiplier;
  
  return {
    regularOvertimePay: regularOvertimePay.toFixed(2),
    weekendOvertimePay: weekendOvertimePay.toFixed(2),
    holidayOvertimePay: holidayOvertimePay.toFixed(2),
    totalOvertimePay: (regularOvertimePay + weekendOvertimePay + holidayOvertimePay).toFixed(2)
  };
};

/**
 * Calculate penalties for late arrival and early leave
 */
export const calculateAttendancePenalties = (attendanceSummary, hourlyRate) => {
  const lateMinutes = attendanceSummary.summary.totalLateMinutes || 0;
  const latePenalty = (lateMinutes / 60) * hourlyRate * 0.5; // 50% deduction for late time
  
  // Additional penalties can be added here (e.g., excessive absences)
  const absentDays = attendanceSummary.summary.daysAbsent;
  const absentPenalty = absentDays * hourlyRate * WORK_CONFIG.standardWorkHours; // Full day deduction
  
  return {
    latePenalty: latePenalty.toFixed(2),
    absentPenalty: absentPenalty.toFixed(2),
    totalPenalties: (latePenalty + absentPenalty).toFixed(2),
    breakdown: {
      lateMinutes,
      absentDays,
      latePenaltyRate: '50% of hourly rate',
      absentPenaltyRate: 'Full day rate'
    }
  };
};

/**
 * Generate attendance-based payslip data
 */
export const generateAttendanceBasedPayslip = async (employee, salaryTemplate, year, month) => {
  try {
    console.log(`🔄 Generating attendance-based payslip for ${employee.firstName} ${employee.lastName}`);
    
    // Load attendance data
    const attendanceRecords = await loadEmployeeAttendanceForMonth(employee.id, year, month);
    
    if (attendanceRecords.length === 0) {
      console.log('⚠️ No attendance records found, using template defaults');
      return null;
    }
    
    // Calculate monthly summary
    const attendanceSummary = calculateMonthlyAttendanceSummary(attendanceRecords);
    
    // Calculate base pay
    const totalRegularHours = parseFloat(attendanceSummary.summary.totalRegularHours);
    const totalOvertimeHours = parseFloat(attendanceSummary.summary.totalOvertimeHours);
    const weekendHours = parseFloat(attendanceSummary.summary.totalWeekendHours);
    
    const basePay = totalRegularHours * salaryTemplate.hourlyRate;
    
    // Calculate overtime pay
    const overtimePay = calculateOvertimePay(
      totalOvertimeHours, 
      weekendHours, 
      salaryTemplate.hourlyRate
    );
    
    // Calculate penalties
    const penalties = calculateAttendancePenalties(attendanceSummary, salaryTemplate.hourlyRate);
    
    // Calculate allowances (from template)
    const totalAllowances = Object.values(salaryTemplate.allowances).reduce((sum, amount) => {
      return sum + (typeof amount === 'number' ? amount : 0);
    }, 0);
    
    // Calculate gross salary
    const grossSalary = basePay + parseFloat(overtimePay.totalOvertimePay) + totalAllowances;
    
    // Calculate deductions (basic + penalties)
    const epfEmployee = grossSalary * 0.11; // 11% EPF
    const socso = Math.min(grossSalary * 0.005, 19.75); // SOCSO (capped)
    const basicDeductions = epfEmployee + socso;
    const totalDeductions = basicDeductions + parseFloat(penalties.totalPenalties);
    
    // Calculate net salary
    const netSalary = grossSalary - totalDeductions;
    
    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      position: employee.position || salaryTemplate.position,
      calculationMethod: 'attendance-based',
      
      // Hours breakdown
      hoursWorked: totalRegularHours.toFixed(2),
      overtimeHours: totalOvertimeHours.toFixed(2),
      weekendHours: weekendHours.toFixed(2),
      
      // Pay breakdown
      basicSalary: basePay.toFixed(2),
      overtimePay: overtimePay.totalOvertimePay,
      allowances: totalAllowances.toFixed(2),
      grossSalary: grossSalary.toFixed(2),
      
      // Deductions breakdown
      epfDeduction: epfEmployee.toFixed(2),
      socsoDeduction: socso.toFixed(2),
      attendancePenalties: penalties.totalPenalties,
      deductions: totalDeductions.toFixed(2),
      
      // Final amount
      netSalary: netSalary.toFixed(2),
      
      // Additional data
      hourlyRate: salaryTemplate.hourlyRate,
      templateUsed: salaryTemplate.id,
      attendanceSummary,
      overtimeBreakdown: overtimePay,
      penaltiesBreakdown: penalties,
      allowanceBreakdown: salaryTemplate.allowances,
      
      // Metadata
      generatedFrom: 'attendance-system',
      dataSource: 'real-attendance-records'
    };
  } catch (error) {
    console.error('Error generating attendance-based payslip:', error);
    return null;
  }
};

/**
 * Get attendance insights for display
 */
export const getAttendanceInsights = (attendanceSummary) => {
  const { summary } = attendanceSummary;
  const insights = [];
  
  // Attendance rate insight
  const attendanceRate = parseFloat(summary.attendanceRate);
  if (attendanceRate >= 95) {
    insights.push({ type: 'success', message: `Excellent attendance rate: ${attendanceRate}%` });
  } else if (attendanceRate >= 85) {
    insights.push({ type: 'warning', message: `Good attendance rate: ${attendanceRate}%` });
  } else {
    insights.push({ type: 'error', message: `Poor attendance rate: ${attendanceRate}% - needs improvement` });
  }
  
  // Overtime insight
  const overtimeHours = parseFloat(summary.totalOvertimeHours);
  if (overtimeHours > 40) {
    insights.push({ type: 'warning', message: `High overtime hours: ${overtimeHours}h - monitor workload` });
  } else if (overtimeHours > 20) {
    insights.push({ type: 'info', message: `Moderate overtime: ${overtimeHours}h` });
  }
  
  // Punctuality insight
  if (summary.daysLate > 5) {
    insights.push({ type: 'error', message: `Frequent lateness: ${summary.daysLate} days late` });
  } else if (summary.daysLate > 2) {
    insights.push({ type: 'warning', message: `Some lateness: ${summary.daysLate} days late` });
  }
  
  // Work hours insight
  const avgHours = parseFloat(summary.averageHoursPerDay);
  if (avgHours < 7) {
    insights.push({ type: 'warning', message: `Below standard hours: ${avgHours}h/day average` });
  } else if (avgHours > 9) {
    insights.push({ type: 'info', message: `Above standard hours: ${avgHours}h/day average` });
  }
  
  return insights;
};