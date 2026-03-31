/**
 * Attendance Record Helpers
 *
 * Centralizes the logic for handling dual field names (clockInTime/checkInTime)
 * that exist in Firestore due to historical inconsistency.
 *
 * All components should use these helpers instead of inline fallback logic.
 */

/**
 * Parse a Firestore timestamp, Date, or string into a JavaScript Date.
 * Returns null if the value cannot be parsed.
 */
export function parseTimestamp(value) {
  if (!value) return null;

  try {
    if (value.toDate) {
      return value.toDate(); // Firestore Timestamp
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Get the check-in time from an attendance record,
 * handling both clockInTime and checkInTime field names.
 * Returns the raw field value (Firestore Timestamp, Date, or string).
 */
export function getRawCheckIn(record) {
  if (!record) return null;
  return record.clockInTime || record.checkInTime || null;
}

/**
 * Get the check-out time from an attendance record,
 * handling both clockOutTime and checkOutTime field names,
 * plus actualCheckOutTime from forgotten checkout requests.
 */
export function getRawCheckOut(record) {
  if (!record) return null;
  return record.actualCheckOutTime || record.clockOutTime || record.checkOutTime || null;
}

/**
 * Get the check-in time as a parsed JS Date.
 */
export function getCheckInTime(record) {
  return parseTimestamp(getRawCheckIn(record));
}

/**
 * Get the check-out time as a parsed JS Date.
 */
export function getCheckOutTime(record) {
  return parseTimestamp(getRawCheckOut(record));
}

/**
 * Check if a user is currently checked in (has check-in but no check-out).
 */
export function isCurrentlyCheckedIn(record) {
  if (!record) return false;
  return !!getRawCheckIn(record) && !getRawCheckOut(record);
}

/**
 * Check if an attendance record has corrupted data
 * (check-out date differs from check-in date).
 */
export function isRecordCorrupted(record) {
  const checkIn = getCheckInTime(record);
  const checkOut = getCheckOutTime(record);

  if (!checkIn || !checkOut) return false;

  try {
    const checkInDate = checkIn.toISOString().split('T')[0];
    const checkOutDate = checkOut.toISOString().split('T')[0];
    return checkInDate !== checkOutDate;
  } catch {
    return true;
  }
}

/**
 * Format a timestamp field to HH:mm string.
 * Returns 'N/A' if the value cannot be parsed.
 */
export function formatTimeHHMM(value) {
  const date = parseTimestamp(value);
  if (!date) return 'N/A';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
