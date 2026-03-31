import {
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { firestoreService } from './dataService';
import { getRawCheckIn, getRawCheckOut, getCheckInTime } from '../utils/attendanceHelpers';

/**
 * Attendance Management Service
 */
export const attendanceService = {
  // Clock in
  async clockIn(attendanceData) {
    try {
      // Validate clock in
      const validationErrors = this.validateClockIn(attendanceData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      // Check if user already has a record for today (prevent duplicates)
      const existingRecord = await this.getTodayAttendance(attendanceData.userId);
      if (existingRecord) {
        if (getRawCheckIn(existingRecord) && !getRawCheckOut(existingRecord)) {
          throw new Error('Already clocked in today');
        }
        // Record exists for today (even if checked out) — don't create duplicate
        throw new Error('Attendance record already exists for today');
      }

      const todayString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const attendanceRecord = {
        ...attendanceData,
        checkInTime: serverTimestamp(),
        clockInTime: serverTimestamp(),
        status: 'present',
        date: todayString,
        dateString: todayString, // For consistent querying across the app
        workingHours: 0,
        overtimeHours: 0,
        notes: attendanceData.notes || ''
      };

      const attendanceId = await firestoreService.create('attendance', attendanceRecord);
      
      // Send notification
      await this.sendAttendanceNotification(attendanceId, 'clock_in');
      
      return { id: attendanceId, ...attendanceRecord };
    } catch (error) {
      console.error('Error clocking in:', error);
      throw error;
    }
  },

  // Clock out
  async clockOut(userId, clockOutData = {}) {
    try {
      // Find today's attendance record
      const todayRecord = await this.getTodayAttendance(userId);
      if (!todayRecord) {
        throw new Error('No clock-in record found for today');
      }

      if (getRawCheckOut(todayRecord)) {
        throw new Error('Already clocked out today');
      }

      const clockOutTime = new Date();
      const clockInTime = getCheckInTime(todayRecord) || new Date();

      // Calculate working hours
      const workingMilliseconds = clockOutTime - clockInTime;
      const workingHours = Math.round((workingMilliseconds / (1000 * 60 * 60)) * 100) / 100;
      
      // Calculate overtime (assuming 8 hours standard)
      const standardHours = 8;
      const overtimeHours = Math.max(0, workingHours - standardHours);

      const updateData = {
        checkOutTime: serverTimestamp(),
        clockOutTime: serverTimestamp(),
        workingHours,
        overtimeHours,
        notes: clockOutData.notes || todayRecord.notes || '',
        location: clockOutData.location || todayRecord.location
      };

      await firestoreService.update('attendance', todayRecord.id, updateData);
      
      // Send notification
      await this.sendAttendanceNotification(todayRecord.id, 'clock_out');
      
      return { ...todayRecord, ...updateData };
    } catch (error) {
      console.error('Error clocking out:', error);
      throw error;
    }
  },

  // Mark break start
  async startBreak(userId, breakData) {
    try {
      const todayRecord = await this.getTodayAttendance(userId);
      if (!todayRecord) {
        throw new Error('No attendance record found for today');
      }

      const breaks = todayRecord.breaks || [];
      const activeBreak = breaks.find(b => b.startTime && !b.endTime);
      
      if (activeBreak) {
        throw new Error('Already on break');
      }

      const newBreak = {
        id: Date.now().toString(),
        type: breakData.type || 'regular',
        startTime: serverTimestamp(),
        notes: breakData.notes || ''
      };

      breaks.push(newBreak);

      await firestoreService.update('attendance', todayRecord.id, {
        breaks,
        currentStatus: 'on_break'
      });

      return newBreak;
    } catch (error) {
      console.error('Error starting break:', error);
      throw error;
    }
  },

  // Mark break end
  async endBreak(userId) {
    try {
      const todayRecord = await this.getTodayAttendance(userId);
      if (!todayRecord) {
        throw new Error('No attendance record found for today');
      }

      const breaks = todayRecord.breaks || [];
      const activeBreakIndex = breaks.findIndex(b => b.startTime && !b.endTime);
      
      if (activeBreakIndex === -1) {
        throw new Error('No active break found');
      }

      breaks[activeBreakIndex].endTime = serverTimestamp();
      breaks[activeBreakIndex].duration = Math.round(
        ((new Date() - new Date(breaks[activeBreakIndex].startTime?.toDate?.() || breaks[activeBreakIndex].startTime)) / (1000 * 60))
      ); // Duration in minutes

      await firestoreService.update('attendance', todayRecord.id, {
        breaks,
        currentStatus: 'working'
      });

      return breaks[activeBreakIndex];
    } catch (error) {
      console.error('Error ending break:', error);
      throw error;
    }
  },

  // Get today's attendance for user
  async getTodayAttendance(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const records = await firestoreService.get('attendance', [
        where('userId', '==', userId),
        where('dateString', '==', today),
        limit(1)
      ]);

      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error getting today attendance:', error);
      throw error;
    }
  },

  // Get user attendance history
  async getUserAttendance(userId, options = {}) {
    try {
      const { startDate, endDate, status, pageSize = 30, lastDoc } = options;
      
      let queryConstraints = [
        where('userId', '==', userId),
        orderBy('date', 'desc')
      ];

      if (status && status !== 'all') {
        queryConstraints.splice(1, 0, where('status', '==', status));
      }

      if (startDate) {
        queryConstraints.push(where('dateString', '>=', startDate));
      }

      if (endDate) {
        queryConstraints.push(where('dateString', '<=', endDate));
      }

      if (pageSize) {
        queryConstraints.push(limit(pageSize));
      }

      if (lastDoc) {
        queryConstraints.push(startAfter(lastDoc));
      }

      return await firestoreService.get('attendance', queryConstraints);
    } catch (error) {
      console.error('Error getting user attendance:', error);
      throw error;
    }
  },

  // Get company attendance (for admin)
  async getCompanyAttendance(company, options = {}) {
    try {
      const { date, department, status, pageSize = 100 } = options;
      
      let queryConstraints = [
        where('company', '==', company)
      ];

      if (date) {
        queryConstraints.push(where('dateString', '==', date));
        queryConstraints.push(orderBy('clockInTime', 'desc'));
      } else {
        queryConstraints.push(orderBy('dateString', 'desc'));
      }

      if (department) {
        queryConstraints.splice(-1, 0, where('department', '==', department));
      }

      if (status && status !== 'all') {
        queryConstraints.splice(-1, 0, where('status', '==', status));
      }

      if (pageSize) {
        queryConstraints.push(limit(pageSize));
      }

      return await firestoreService.get('attendance', queryConstraints);
    } catch (error) {
      console.error('Error getting company attendance:', error);
      throw error;
    }
  },

  // Get attendance statistics
  async getAttendanceStatistics(company, options = {}) {
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
          where('dateString', '>=', startDate),
          where('dateString', '<=', endDate)
        );
      }

      const attendance = await firestoreService.get('attendance', queryConstraints);
      
      // Calculate statistics
      const stats = {
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        late: attendance.filter(a => a.status === 'late').length,
        overtime: attendance.filter(a => (a.overtimeHours || 0) > 0).length,
        totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
        totalOvertimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0),
        averageWorkingHours: 0,
        byDepartment: {},
        byDate: {},
        attendanceRate: 0
      };

      // Calculate averages
      stats.averageWorkingHours = stats.total > 0 ? Math.round((stats.totalWorkingHours / stats.total) * 100) / 100 : 0;
      stats.attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

      attendance.forEach(record => {
        // By department
        stats.byDepartment[record.department] = (stats.byDepartment[record.department] || 0) + 1;
        
        // By date
        stats.byDate[record.date] = (stats.byDate[record.date] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting attendance statistics:', error);
      throw error;
    }
  },

  // Mark attendance manually (admin)
  async markAttendance(attendanceData) {
    try {
      // Check if record already exists
      const existingRecord = await firestoreService.get('attendance', [
        where('userId', '==', attendanceData.userId),
        where('dateString', '==', attendanceData.date),
        limit(1)
      ]);

      if (existingRecord.length > 0) {
        // Update existing record
        const updateData = {
          status: attendanceData.status,
          checkInTime: attendanceData.clockInTime || attendanceData.checkInTime ? serverTimestamp() : null,
          clockInTime: attendanceData.clockInTime || attendanceData.checkInTime ? serverTimestamp() : null,
          checkOutTime: attendanceData.clockOutTime || attendanceData.checkOutTime ? serverTimestamp() : null,
          clockOutTime: attendanceData.clockOutTime || attendanceData.checkOutTime ? serverTimestamp() : null,
          workingHours: attendanceData.workingHours || 0,
          overtimeHours: attendanceData.overtimeHours || 0,
          notes: attendanceData.notes || '',
          markedBy: attendanceData.markedBy
        };

        await firestoreService.update('attendance', existingRecord[0].id, updateData);
        return { id: existingRecord[0].id, ...existingRecord[0], ...updateData };
      } else {
        // Create new record
        const newRecord = {
          ...attendanceData,
          markedBy: attendanceData.markedBy,
          markedAt: serverTimestamp()
        };

        const attendanceId = await firestoreService.create('attendance', newRecord);
        return { id: attendanceId, ...newRecord };
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  },

  // Validate clock in
  validateClockIn(attendanceData) {
    const errors = [];
    
    if (!attendanceData.userId) {
      errors.push('User ID is required');
    }
    
    if (!attendanceData.userName) {
      errors.push('User name is required');
    }
    
    if (!attendanceData.company) {
      errors.push('Company is required');
    }
    
    if (!attendanceData.department) {
      errors.push('Department is required');
    }

    // Check if clocking in during business hours
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour < 6 || currentHour > 23) {
      errors.push('Clock in outside of allowed hours (6 AM - 11 PM)');
    }

    return errors;
  },

  // Calculate late status
  // Compares using Date objects to avoid string comparison bugs (e.g. "9:05" > "09:00" fails)
  calculateLateStatus(clockInTime, standardStartTime = '09:00') {
    // Ensure clockInTime is a proper Date object
    let clockIn;
    if (clockInTime instanceof Date) {
      clockIn = clockInTime;
    } else if (clockInTime && typeof clockInTime.toDate === 'function') {
      // Handle Firestore Timestamp objects
      clockIn = clockInTime.toDate();
    } else {
      clockIn = new Date(clockInTime);
    }

    // Validate that clockIn is a valid date
    if (isNaN(clockIn.getTime())) {
      console.warn('calculateLateStatus: Invalid clockInTime provided:', clockInTime);
      return { isLate: false, lateMinutes: 0, lateByMinutes: 0, status: 'present' };
    }

    // Parse standardStartTime string (e.g. "09:00" or "9:00") into hours and minutes
    const timeParts = standardStartTime.split(':');
    const startHours = parseInt(timeParts[0], 10);
    const startMinutes = parseInt(timeParts[1] || '0', 10);

    // Build the threshold as a Date on the same calendar day as the clock-in
    const threshold = new Date(clockIn);
    threshold.setHours(startHours, startMinutes, 0, 0);

    // Compare Date objects (millisecond arithmetic, not string comparison)
    const diffMs = clockIn.getTime() - threshold.getTime();
    const lateMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));

    return {
      isLate: lateMinutes > 0,
      lateMinutes,
      lateByMinutes: lateMinutes, // Alias used by Dashboard.js
      status: lateMinutes > 0 ? 'late' : 'present'
    };
  },

  // Send attendance notification
  async sendAttendanceNotification(attendanceId, type) {
    try {
      const attendance = await firestoreService.getById('attendance', attendanceId);
      
      if (attendance) {
        let message = '';
        switch (type) {
          case 'clock_in':
            message = `Clocked in successfully at ${new Date().toLocaleTimeString()}`;
            break;
          case 'clock_out':
            message = `Clocked out successfully at ${new Date().toLocaleTimeString()}`;
            break;
          default:
            message = 'Attendance updated';
        }

        const notification = {
          userId: attendance.userId,
          type: 'attendance_update',
          title: 'Attendance Update',
          message,
          attendanceId,
          read: false,
          createdAt: serverTimestamp()
        };
        
        await firestoreService.create('notifications', notification);
      }
    } catch (error) {
      console.error('Error sending attendance notification:', error);
    }
  },

  // Get work schedule for user
  async getUserWorkSchedule(userId) {
    try {
      const user = await firestoreService.getById('users', userId);
      
      if (user && user.workSchedule) {
        return user.workSchedule;
      }

      // Default work schedule
      return {
        monday: { start: '09:00', end: '17:00', isWorkday: true },
        tuesday: { start: '09:00', end: '17:00', isWorkday: true },
        wednesday: { start: '09:00', end: '17:00', isWorkday: true },
        thursday: { start: '09:00', end: '17:00', isWorkday: true },
        friday: { start: '09:00', end: '17:00', isWorkday: true },
        saturday: { start: '09:00', end: '13:00', isWorkday: false },
        sunday: { start: '09:00', end: '13:00', isWorkday: false }
      };
    } catch (error) {
      console.error('Error getting work schedule:', error);
      throw error;
    }
  },

  // Listen to user attendance (real-time)
  listenToUserAttendance(userId, callback) {
    return firestoreService.listen('attendance', [
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(30)
    ], callback);
  },

  // Listen to company attendance (real-time for admin)
  listenToCompanyAttendance(company, callback) {
    const today = new Date().toISOString().split('T')[0];
    return firestoreService.listen('attendance', [
      where('company', '==', company),
      where('dateString', '==', today),
      orderBy('clockInTime', 'desc')
    ], callback);
  },

  // Generate attendance report
  async generateAttendanceReport(company, options = {}) {
    try {
      const { startDate, endDate, format = 'summary', department } = options;
      
      const attendance = await this.getCompanyAttendance(company, { 
        startDate, 
        endDate, 
        department,
        pageSize: 5000 
      });

      if (format === 'summary') {
        return this.getAttendanceStatistics(company, options);
      } else {
        // Detailed report
        return {
          period: { startDate, endDate },
          totalRecords: attendance.length,
          attendance: attendance.map(record => ({
            id: record.id,
            employee: record.userName,
            department: record.department,
            date: record.date,
            clockIn: getRawCheckIn(record),
            clockOut: getRawCheckOut(record),
            workingHours: record.workingHours,
            overtimeHours: record.overtimeHours,
            status: record.status,
            breaks: record.breaks?.length || 0
          }))
        };
      }
    } catch (error) {
      console.error('Error generating attendance report:', error);
      throw error;
    }
  }
};