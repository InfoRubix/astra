import { where } from 'firebase/firestore';
import { firestoreService } from './dataService';
import {
  getCheckInTime,
  getCheckOutTime,
  parseTimestamp
} from '../utils/attendanceHelpers';

/**
 * Enhanced Reporting Service – Dashboard V2
 *
 * Provides advanced analytics and reporting on top of the existing
 * attendance and leave data stored in Firestore.
 */
export const reportingService = {
  // ---------------------------------------------------------------------------
  // Helpers (internal)
  // ---------------------------------------------------------------------------

  /**
   * Build an array of YYYY-MM-DD strings between two dates (inclusive).
   */
  _dateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },

  /**
   * Convert minutes-since-midnight back to an "HH:mm" string.
   */
  _minutesToTimeString(totalMinutes) {
    if (totalMinutes == null || isNaN(totalMinutes)) return 'N/A';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  /**
   * Return the minute-of-day for a Date (e.g. 09:30 -> 570).
   */
  _timeToMinutes(date) {
    if (!date) return null;
    return date.getHours() * 60 + date.getMinutes();
  },

  /**
   * Safely compute an average from a numeric array, rounded to 2 dp.
   */
  _average(arr) {
    if (!arr.length) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
  },

  /**
   * Get the YYYY-MM label for a Date.
   */
  _monthLabel(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },

  /**
   * Fetch all employees for a company, optionally filtered by department.
   */
  async _getEmployees(company, department) {
    const constraints = [where('company', '==', company)];
    if (department) {
      constraints.push(where('department', '==', department));
    }
    return firestoreService.get('users', constraints);
  },

  /**
   * Fetch attendance records for a company within a date range.
   * Optionally filter by department.
   */
  async _getAttendanceRecords(company, startDate, endDate, department) {
    const constraints = [where('company', '==', company)];

    if (department) {
      constraints.push(where('department', '==', department));
    }

    if (startDate) {
      constraints.push(where('dateString', '>=', startDate));
    }
    if (endDate) {
      constraints.push(where('dateString', '<=', endDate));
    }

    return firestoreService.get('attendance', constraints);
  },

  /**
   * Fetch leave records for a company, optionally filtered by date range
   * and department.  Only approved leaves are returned by default.
   */
  async _getLeaveRecords(company, options = {}) {
    const { startDate, endDate, department, statusFilter } = options;

    const constraints = [where('company', '==', company)];

    if (department) {
      constraints.push(where('department', '==', department));
    }

    const leaves = await firestoreService.get('leaves', constraints);

    // Client-side filtering to avoid composite-index issues (matching leaveService pattern)
    let filtered = leaves;

    if (statusFilter) {
      filtered = filtered.filter(l => l.status === statusFilter);
    }

    if (startDate || endDate) {
      filtered = filtered.filter(leave => {
        const leaveStart = leave.startDate
          ? new Date(leave.startDate)
          : (leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate));

        if (startDate && leaveStart < new Date(startDate)) return false;
        if (endDate && leaveStart > new Date(endDate)) return false;
        return true;
      });
    }

    return filtered;
  },

  // ---------------------------------------------------------------------------
  // 1. generateAttendanceOverview
  // ---------------------------------------------------------------------------

  /**
   * Comprehensive attendance overview for the dashboard.
   *
   * @param {Object} options
   * @param {string} options.startDate  - YYYY-MM-DD
   * @param {string} options.endDate    - YYYY-MM-DD
   * @param {string} options.company    - Company identifier
   * @param {string} [options.department] - Optional department filter
   *
   * @returns {Object} Overview stats + trend data
   */
  async generateAttendanceOverview(options = {}) {
    try {
      const { startDate, endDate, company, department } = options;

      if (!company) throw new Error('Company is required');

      // Fetch employees & attendance in parallel
      const [employees, attendance, approvedLeaves] = await Promise.all([
        this._getEmployees(company, department),
        this._getAttendanceRecords(company, startDate, endDate, department),
        this._getLeaveRecords(company, {
          startDate,
          endDate,
          department,
          statusFilter: 'approved'
        })
      ]);

      const totalEmployees = employees.length;
      const today = new Date().toISOString().split('T')[0];

      // --- Today snapshots ---
      const todayRecords = attendance.filter(r => r.dateString === today || r.date === today);
      const presentToday = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const lateArrivals = todayRecords.filter(r => r.status === 'late').length;

      // On leave today – approved leaves whose date range covers today
      const todayDate = new Date(today);
      const onLeaveToday = approvedLeaves.filter(l => {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        return todayDate >= lStart && todayDate <= lEnd;
      }).length;

      const absentToday = Math.max(0, totalEmployees - presentToday - onLeaveToday);

      // --- Period aggregates ---
      const workingHoursArr = attendance
        .map(r => r.workingHours || 0)
        .filter(h => h > 0);
      const averageWorkingHours = this._average(workingHoursArr);

      const overtimeHours = attendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
      const totalPresentOrLate = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = attendance.length > 0
        ? Math.round((totalPresentOrLate / attendance.length) * 10000) / 100
        : 0;

      // --- Trend data (per day) ---
      const dateRange = (startDate && endDate) ? this._dateRange(startDate, endDate) : [];
      const trendData = dateRange.map(date => {
        const dayRecords = attendance.filter(r => (r.dateString || r.date) === date);
        return {
          date,
          present: dayRecords.filter(r => r.status === 'present').length,
          absent: Math.max(0, totalEmployees - dayRecords.length),
          late: dayRecords.filter(r => r.status === 'late').length
        };
      });

      return {
        totalEmployees,
        presentToday,
        absentToday,
        onLeaveToday,
        lateArrivals,
        attendanceRate,
        averageWorkingHours,
        overtimeHours,
        trendData
      };
    } catch (error) {
      console.error('Error generating attendance overview:', error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // 2. generateEmployeePerformanceReport
  // ---------------------------------------------------------------------------

  /**
   * Individual employee performance report.
   *
   * @param {string} employeeId
   * @param {Object} options
   * @param {string} options.startDate - YYYY-MM-DD
   * @param {string} options.endDate   - YYYY-MM-DD
   *
   * @returns {Object} Performance metrics + monthly trend
   */
  async generateEmployeePerformanceReport(employeeId, options = {}) {
    try {
      const { startDate, endDate } = options;

      if (!employeeId) throw new Error('Employee ID is required');

      const constraints = [where('userId', '==', employeeId)];
      if (startDate) constraints.push(where('dateString', '>=', startDate));
      if (endDate) constraints.push(where('dateString', '<=', endDate));

      const attendance = await firestoreService.get('attendance', constraints);

      // Day counts
      const daysPresent = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
      const daysAbsent = attendance.filter(r => r.status === 'absent').length;
      const daysLate = attendance.filter(r => r.status === 'late').length;

      // Check-in / check-out averages (in minutes-of-day)
      const checkInMinutes = [];
      const checkOutMinutes = [];
      const hoursArr = [];

      attendance.forEach(record => {
        const cin = getCheckInTime(record);
        const cout = getCheckOutTime(record);

        if (cin) {
          const m = this._timeToMinutes(cin);
          if (m !== null) checkInMinutes.push(m);
        }
        if (cout) {
          const m = this._timeToMinutes(cout);
          if (m !== null) checkOutMinutes.push(m);
        }
        if (record.workingHours) {
          hoursArr.push(record.workingHours);
        }
      });

      const averageCheckInTime = this._minutesToTimeString(this._average(checkInMinutes));
      const averageCheckOutTime = this._minutesToTimeString(this._average(checkOutMinutes));
      const averageWorkingHours = this._average(hoursArr);
      const totalOvertimeHours = Math.round(
        attendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0) * 100
      ) / 100;

      const punctualityRate = daysPresent > 0
        ? Math.round(((daysPresent - daysLate) / daysPresent) * 10000) / 100
        : 0;

      // --- Monthly trend ---
      const monthlyMap = {};
      attendance.forEach(record => {
        const dateStr = record.dateString || record.date;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const key = this._monthLabel(d);

        if (!monthlyMap[key]) {
          monthlyMap[key] = { month: key, daysPresent: 0, daysLate: 0, hoursArr: [] };
        }
        if (record.status === 'present' || record.status === 'late') {
          monthlyMap[key].daysPresent += 1;
        }
        if (record.status === 'late') {
          monthlyMap[key].daysLate += 1;
        }
        if (record.workingHours) {
          monthlyMap[key].hoursArr.push(record.workingHours);
        }
      });

      const monthlyTrend = Object.values(monthlyMap)
        .map(m => ({
          month: m.month,
          daysPresent: m.daysPresent,
          daysLate: m.daysLate,
          avgHours: this._average(m.hoursArr)
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        daysPresent,
        daysAbsent,
        daysLate,
        averageCheckInTime,
        averageCheckOutTime,
        averageWorkingHours,
        totalOvertimeHours,
        punctualityRate,
        monthlyTrend
      };
    } catch (error) {
      console.error('Error generating employee performance report:', error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // 3. generateDepartmentComparison
  // ---------------------------------------------------------------------------

  /**
   * Compare departments within a company.
   *
   * @param {string} company
   * @param {Object} [options]
   * @param {string} [options.startDate]
   * @param {string} [options.endDate]
   *
   * @returns {Object[]} Per-department metrics
   */
  async generateDepartmentComparison(company, options = {}) {
    try {
      const { startDate, endDate } = options;

      if (!company) throw new Error('Company is required');

      const [employees, attendance] = await Promise.all([
        this._getEmployees(company),
        this._getAttendanceRecords(company, startDate, endDate)
      ]);

      // Group employees by department
      const deptEmployees = {};
      employees.forEach(emp => {
        const dept = emp.department || 'Unassigned';
        if (!deptEmployees[dept]) deptEmployees[dept] = [];
        deptEmployees[dept].push(emp);
      });

      // Group attendance by department
      const deptAttendance = {};
      attendance.forEach(record => {
        const dept = record.department || 'Unassigned';
        if (!deptAttendance[dept]) deptAttendance[dept] = [];
        deptAttendance[dept].push(record);
      });

      // All department names (union of both sets)
      const allDepts = new Set([...Object.keys(deptEmployees), ...Object.keys(deptAttendance)]);

      const comparison = [];

      allDepts.forEach(dept => {
        const empCount = (deptEmployees[dept] || []).length;
        const records = deptAttendance[dept] || [];
        const totalRecords = records.length;

        const presentOrLate = records.filter(r => r.status === 'present' || r.status === 'late').length;
        const lateCount = records.filter(r => r.status === 'late').length;
        const overtimeCount = records.filter(r => (r.overtimeHours || 0) > 0).length;

        const hoursArr = records
          .map(r => r.workingHours || 0)
          .filter(h => h > 0);

        comparison.push({
          department: dept,
          employeeCount: empCount,
          totalRecords,
          attendanceRate: totalRecords > 0
            ? Math.round((presentOrLate / totalRecords) * 10000) / 100
            : 0,
          averageHours: this._average(hoursArr),
          lateRate: totalRecords > 0
            ? Math.round((lateCount / totalRecords) * 10000) / 100
            : 0,
          overtimeRate: totalRecords > 0
            ? Math.round((overtimeCount / totalRecords) * 10000) / 100
            : 0
        });
      });

      // Sort by attendance rate descending
      comparison.sort((a, b) => b.attendanceRate - a.attendanceRate);

      return comparison;
    } catch (error) {
      console.error('Error generating department comparison:', error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // 4. generateMonthlyDigest
  // ---------------------------------------------------------------------------

  /**
   * Monthly digest with top performers, late arrivals, overtime leaders,
   * department breakdown, and comparison with the previous month.
   *
   * @param {string} company
   * @param {number} year
   * @param {number} month  - 1-12
   *
   * @returns {Object} Monthly digest
   */
  async generateMonthlyDigest(company, year, month) {
    try {
      if (!company) throw new Error('Company is required');
      if (!year || !month) throw new Error('Year and month are required');

      // Build date ranges for current and previous month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

      // Fetch current and previous month attendance in parallel
      const [employees, currentAttendance, previousAttendance] = await Promise.all([
        this._getEmployees(company),
        this._getAttendanceRecords(company, startDate, endDate),
        this._getAttendanceRecords(company, prevStartDate, prevEndDate)
      ]);

      // --- Per-employee aggregation (current month) ---
      const employeeStats = {};
      employees.forEach(emp => {
        employeeStats[emp.id] = {
          id: emp.id,
          name: emp.displayName || emp.name || emp.email || 'Unknown',
          department: emp.department || 'Unassigned',
          daysPresent: 0,
          daysLate: 0,
          totalRecords: 0,
          overtimeHours: 0
        };
      });

      currentAttendance.forEach(record => {
        const uid = record.userId;
        if (!employeeStats[uid]) {
          employeeStats[uid] = {
            id: uid,
            name: record.userName || 'Unknown',
            department: record.department || 'Unassigned',
            daysPresent: 0,
            daysLate: 0,
            totalRecords: 0,
            overtimeHours: 0
          };
        }
        employeeStats[uid].totalRecords += 1;
        if (record.status === 'present' || record.status === 'late') {
          employeeStats[uid].daysPresent += 1;
        }
        if (record.status === 'late') {
          employeeStats[uid].daysLate += 1;
        }
        employeeStats[uid].overtimeHours += (record.overtimeHours || 0);
      });

      const statsList = Object.values(employeeStats);

      // Top performers (best attendance rate, min 1 record)
      const topPerformers = statsList
        .filter(s => s.totalRecords > 0)
        .map(s => ({
          id: s.id,
          name: s.name,
          department: s.department,
          attendanceRate: Math.round((s.daysPresent / s.totalRecords) * 10000) / 100,
          daysPresent: s.daysPresent
        }))
        .sort((a, b) => b.attendanceRate - a.attendanceRate || b.daysPresent - a.daysPresent)
        .slice(0, 10);

      // Most late arrivals
      const mostLateArrivals = statsList
        .filter(s => s.daysLate > 0)
        .map(s => ({
          id: s.id,
          name: s.name,
          department: s.department,
          lateDays: s.daysLate
        }))
        .sort((a, b) => b.lateDays - a.lateDays)
        .slice(0, 10);

      // Overtime leaders
      const overtimeLeaders = statsList
        .filter(s => s.overtimeHours > 0)
        .map(s => ({
          id: s.id,
          name: s.name,
          department: s.department,
          overtimeHours: Math.round(s.overtimeHours * 100) / 100
        }))
        .sort((a, b) => b.overtimeHours - a.overtimeHours)
        .slice(0, 10);

      // Department breakdown
      const deptMap = {};
      currentAttendance.forEach(record => {
        const dept = record.department || 'Unassigned';
        if (!deptMap[dept]) {
          deptMap[dept] = { department: dept, present: 0, late: 0, absent: 0, total: 0 };
        }
        deptMap[dept].total += 1;
        if (record.status === 'present') deptMap[dept].present += 1;
        if (record.status === 'late') { deptMap[dept].late += 1; deptMap[dept].present += 1; }
        if (record.status === 'absent') deptMap[dept].absent += 1;
      });

      const departmentBreakdown = Object.values(deptMap).map(d => ({
        ...d,
        attendanceRate: d.total > 0
          ? Math.round((d.present / d.total) * 10000) / 100
          : 0
      }));

      // --- Previous month comparison ---
      const prevPresentOrLate = previousAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
      const prevLate = previousAttendance.filter(r => r.status === 'late').length;
      const prevOvertime = previousAttendance.reduce((s, r) => s + (r.overtimeHours || 0), 0);

      const curPresentOrLate = currentAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
      const curLate = currentAttendance.filter(r => r.status === 'late').length;
      const curOvertime = currentAttendance.reduce((s, r) => s + (r.overtimeHours || 0), 0);

      const curAttendanceRate = currentAttendance.length > 0
        ? Math.round((curPresentOrLate / currentAttendance.length) * 10000) / 100
        : 0;
      const prevAttendanceRate = previousAttendance.length > 0
        ? Math.round((prevPresentOrLate / previousAttendance.length) * 10000) / 100
        : 0;

      const previousMonthComparison = {
        currentMonth: { year, month, totalRecords: currentAttendance.length, attendanceRate: curAttendanceRate, lateCount: curLate, overtimeHours: Math.round(curOvertime * 100) / 100 },
        previousMonth: { year: prevYear, month: prevMonth, totalRecords: previousAttendance.length, attendanceRate: prevAttendanceRate, lateCount: prevLate, overtimeHours: Math.round(prevOvertime * 100) / 100 },
        changes: {
          attendanceRateChange: Math.round((curAttendanceRate - prevAttendanceRate) * 100) / 100,
          lateCountChange: curLate - prevLate,
          overtimeChange: Math.round((curOvertime - prevOvertime) * 100) / 100
        }
      };

      return {
        company,
        year,
        month,
        totalEmployees: employees.length,
        totalRecords: currentAttendance.length,
        topPerformers,
        mostLateArrivals,
        overtimeLeaders,
        departmentBreakdown,
        previousMonthComparison
      };
    } catch (error) {
      console.error('Error generating monthly digest:', error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // 5. generateLeaveAnalytics
  // ---------------------------------------------------------------------------

  /**
   * Leave analytics and insights.
   *
   * @param {string} company
   * @param {Object} [options]
   * @param {string} [options.startDate]
   * @param {string} [options.endDate]
   * @param {string} [options.department]
   *
   * @returns {Object} Leave analytics
   */
  async generateLeaveAnalytics(company, options = {}) {
    try {
      const { startDate, endDate, department } = options;

      if (!company) throw new Error('Company is required');

      // Fetch all leaves (any status) and approved leaves separately
      const [allLeaves, approvedLeaves] = await Promise.all([
        this._getLeaveRecords(company, { startDate, endDate, department }),
        this._getLeaveRecords(company, { startDate, endDate, department, statusFilter: 'approved' })
      ]);

      // --- Leaves by type ---
      const leavesByType = {};
      approvedLeaves.forEach(leave => {
        const type = leave.leaveType || 'other';
        if (!leavesByType[type]) leavesByType[type] = 0;
        leavesByType[type] += (leave.totalDays || 1);
      });

      // --- Leaves trend (monthly count of approved leaves) ---
      const trendMap = {};
      approvedLeaves.forEach(leave => {
        const appliedDate = leave.appliedDate?.toDate
          ? leave.appliedDate.toDate()
          : new Date(leave.appliedDate || leave.startDate);
        const key = this._monthLabel(appliedDate);

        if (!trendMap[key]) trendMap[key] = 0;
        trendMap[key] += 1;
      });

      const leavesTrend = Object.entries(trendMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // --- Top leave users ---
      const userLeaveMap = {};
      approvedLeaves.forEach(leave => {
        const uid = leave.userId;
        if (!userLeaveMap[uid]) {
          userLeaveMap[uid] = {
            userId: uid,
            name: leave.userName || 'Unknown',
            department: leave.department || 'Unassigned',
            totalDays: 0,
            leaveCount: 0
          };
        }
        userLeaveMap[uid].totalDays += (leave.totalDays || 1);
        userLeaveMap[uid].leaveCount += 1;
      });

      const topLeaveUsers = Object.values(userLeaveMap)
        .sort((a, b) => b.totalDays - a.totalDays)
        .slice(0, 10);

      // --- Peak leave periods (which months have the most leave days) ---
      const periodMap = {};
      approvedLeaves.forEach(leave => {
        // Spread leave days across covered months
        const lStart = new Date(leave.startDate);
        const lEnd = new Date(leave.endDate || leave.startDate);
        const cursor = new Date(lStart);

        while (cursor <= lEnd) {
          const key = this._monthLabel(cursor);
          if (!periodMap[key]) periodMap[key] = 0;
          periodMap[key] += 1;
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      const peakLeavePeriods = Object.entries(periodMap)
        .map(([month, days]) => ({ month, days }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 6);

      return {
        totalLeaves: allLeaves.length,
        approvedLeaves: approvedLeaves.length,
        leavesByType,
        leavesTrend,
        topLeaveUsers,
        peakLeavePeriods
      };
    } catch (error) {
      console.error('Error generating leave analytics:', error);
      throw error;
    }
  }
};
