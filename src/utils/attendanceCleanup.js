import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getCheckInTime, getCheckOutTime, getRawCheckIn, getRawCheckOut } from './attendanceHelpers';

/**
 * Attendance Data Cleanup Utility
 *
 * Scans all attendance records for data integrity issues and fixes them.
 * Designed to be called from the admin panel or browser console.
 */

/**
 * Scan all attendance records and return a report of corrupted data.
 */
export async function scanCorruptedRecords() {
  const snapshot = await getDocs(collection(db, 'attendance'));
  const issues = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const checkIn = getCheckInTime({ ...data });
    const checkOut = getCheckOutTime({ ...data });

    // Issue 1: Check-out before check-in
    if (checkIn && checkOut && checkOut < checkIn) {
      issues.push({
        id,
        type: 'checkout_before_checkin',
        description: `Check-out (${checkOut.toISOString()}) is before check-in (${checkIn.toISOString()})`,
        data: { userId: data.userId, userName: data.userName, dateString: data.dateString }
      });
    }

    // Issue 2: Check-in and check-out on different dates
    if (checkIn && checkOut) {
      const inDate = checkIn.toISOString().split('T')[0];
      const outDate = checkOut.toISOString().split('T')[0];
      if (inDate !== outDate) {
        issues.push({
          id,
          type: 'date_mismatch',
          description: `Check-in date (${inDate}) differs from check-out date (${outDate})`,
          data: { userId: data.userId, userName: data.userName, dateString: data.dateString }
        });
      }
    }

    // Issue 3: Working hours negative or unreasonably high (>16h)
    if (data.workingHours != null && (data.workingHours < 0 || data.workingHours > 16)) {
      issues.push({
        id,
        type: 'invalid_working_hours',
        description: `Working hours is ${data.workingHours} (expected 0–16)`,
        data: { userId: data.userId, userName: data.userName, dateString: data.dateString }
      });
    }

    // Issue 4: Missing dateString field
    if (!data.dateString && !data.date) {
      issues.push({
        id,
        type: 'missing_date',
        description: 'Record has no dateString or date field',
        data: { userId: data.userId, userName: data.userName }
      });
    }

    // Issue 5: Has check-in but with inconsistent field names (only one of clockInTime/checkInTime)
    const hasClockIn = !!data.clockInTime;
    const hasCheckIn = !!data.checkInTime;
    if ((hasClockIn && !hasCheckIn) || (!hasClockIn && hasCheckIn)) {
      issues.push({
        id,
        type: 'inconsistent_field_names',
        description: `Has ${hasClockIn ? 'clockInTime' : 'checkInTime'} but missing ${hasClockIn ? 'checkInTime' : 'clockInTime'}`,
        data: { userId: data.userId, userName: data.userName, dateString: data.dateString }
      });
    }
  });

  return {
    totalRecords: snapshot.size,
    totalIssues: issues.length,
    issues
  };
}

/**
 * Fix corrupted records:
 * - Normalize field names (ensure both clockInTime and checkInTime exist)
 * - Remove check-out data for records where checkout is before checkin
 * - Recalculate working hours for date-mismatch records
 */
export async function fixCorruptedRecords(dryRun = true) {
  const report = await scanCorruptedRecords();
  const fixes = [];

  for (const issue of report.issues) {
    const ref = doc(db, 'attendance', issue.id);

    if (issue.type === 'inconsistent_field_names') {
      // Sync the missing field name from the existing one
      const snapshot = await getDocs(collection(db, 'attendance'));
      const docSnap = snapshot.docs.find((d) => d.id === issue.id);
      if (!docSnap) continue;

      const data = docSnap.data();
      const update = {};

      if (data.clockInTime && !data.checkInTime) {
        update.checkInTime = data.clockInTime;
      } else if (data.checkInTime && !data.clockInTime) {
        update.clockInTime = data.checkInTime;
      }
      if (data.clockOutTime && !data.checkOutTime) {
        update.checkOutTime = data.clockOutTime;
      } else if (data.checkOutTime && !data.clockOutTime) {
        update.clockOutTime = data.checkOutTime;
      }

      if (Object.keys(update).length > 0) {
        if (!dryRun) await updateDoc(ref, update);
        fixes.push({ id: issue.id, action: 'sync_field_names', update });
      }
    }

    if (issue.type === 'checkout_before_checkin') {
      // Remove the invalid check-out so the record looks "in-progress"
      const update = {
        clockOutTime: deleteField(),
        checkOutTime: deleteField(),
        workingHours: 0,
        overtimeHours: 0,
        status: 'present',
        notes: 'Auto-fixed: checkout was before checkin, checkout removed'
      };
      if (!dryRun) await updateDoc(ref, update);
      fixes.push({ id: issue.id, action: 'remove_invalid_checkout', update: '(checkout fields deleted)' });
    }

    if (issue.type === 'invalid_working_hours') {
      // Recalculate working hours from timestamps
      const snapshot = await getDocs(collection(db, 'attendance'));
      const docSnap = snapshot.docs.find((d) => d.id === issue.id);
      if (!docSnap) continue;

      const data = docSnap.data();
      const checkIn = getCheckInTime(data);
      const checkOut = getCheckOutTime(data);

      if (checkIn && checkOut && checkOut > checkIn) {
        const hours = Math.min((checkOut - checkIn) / (1000 * 60 * 60), 16);
        const overtime = Math.max(0, hours - 8);
        const update = {
          workingHours: parseFloat(hours.toFixed(2)),
          overtimeHours: parseFloat(overtime.toFixed(2))
        };
        if (!dryRun) await updateDoc(ref, update);
        fixes.push({ id: issue.id, action: 'recalculate_hours', update });
      }
    }
  }

  return {
    dryRun,
    totalIssues: report.totalIssues,
    totalFixes: fixes.length,
    fixes
  };
}
