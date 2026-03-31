import {
  parseTimestamp,
  getRawCheckIn,
  getRawCheckOut,
  getCheckInTime,
  getCheckOutTime,
  isCurrentlyCheckedIn,
  isRecordCorrupted,
  formatTimeHHMM,
} from '../../utils/attendanceHelpers';

// ---------------------------------------------------------------------------
// parseTimestamp
// ---------------------------------------------------------------------------
describe('parseTimestamp', () => {
  it('returns null for null input', () => {
    expect(parseTimestamp(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseTimestamp(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTimestamp('')).toBeNull();
  });

  it('returns null for 0 (falsy number)', () => {
    expect(parseTimestamp(0)).toBeNull();
  });

  it('converts a Firestore-like Timestamp object (has toDate)', () => {
    const fakeDate = new Date('2025-06-15T09:30:00Z');
    const firestoreTimestamp = { toDate: () => fakeDate };

    expect(parseTimestamp(firestoreTimestamp)).toBe(fakeDate);
  });

  it('returns the same Date when given a Date object', () => {
    const d = new Date('2025-01-01T08:00:00Z');
    expect(parseTimestamp(d)).toBe(d);
  });

  it('parses a valid ISO date string', () => {
    const result = parseTimestamp('2025-03-20T10:15:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2025-03-20T10:15:00.000Z');
  });

  it('parses a valid date-only string', () => {
    const result = parseTimestamp('2025-03-20');
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(parseTimestamp('not-a-date')).toBeNull();
  });

  it('returns null when toDate throws', () => {
    const bad = {
      toDate: () => {
        throw new Error('corrupt');
      },
    };
    expect(parseTimestamp(bad)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRawCheckIn
// ---------------------------------------------------------------------------
describe('getRawCheckIn', () => {
  it('returns null when record is null', () => {
    expect(getRawCheckIn(null)).toBeNull();
  });

  it('returns null when record is undefined', () => {
    expect(getRawCheckIn(undefined)).toBeNull();
  });

  it('returns clockInTime when present', () => {
    const record = { clockInTime: 'ts-clock-in' };
    expect(getRawCheckIn(record)).toBe('ts-clock-in');
  });

  it('returns checkInTime when clockInTime is absent', () => {
    const record = { checkInTime: 'ts-check-in' };
    expect(getRawCheckIn(record)).toBe('ts-check-in');
  });

  it('prefers clockInTime over checkInTime', () => {
    const record = { clockInTime: 'primary', checkInTime: 'secondary' };
    expect(getRawCheckIn(record)).toBe('primary');
  });

  it('returns null when neither field is present', () => {
    const record = { status: 'present' };
    expect(getRawCheckIn(record)).toBeNull();
  });

  it('returns null when both fields are falsy', () => {
    const record = { clockInTime: null, checkInTime: undefined };
    expect(getRawCheckIn(record)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRawCheckOut
// ---------------------------------------------------------------------------
describe('getRawCheckOut', () => {
  it('returns null when record is null', () => {
    expect(getRawCheckOut(null)).toBeNull();
  });

  it('returns null when record is undefined', () => {
    expect(getRawCheckOut(undefined)).toBeNull();
  });

  it('returns actualCheckOutTime when present (forgotten checkout)', () => {
    const record = { actualCheckOutTime: 'actual', clockOutTime: 'clock', checkOutTime: 'check' };
    expect(getRawCheckOut(record)).toBe('actual');
  });

  it('returns clockOutTime when actualCheckOutTime is absent', () => {
    const record = { clockOutTime: 'clock-out', checkOutTime: 'check-out' };
    expect(getRawCheckOut(record)).toBe('clock-out');
  });

  it('returns checkOutTime as last fallback', () => {
    const record = { checkOutTime: 'check-out' };
    expect(getRawCheckOut(record)).toBe('check-out');
  });

  it('returns null when no checkout fields exist', () => {
    const record = { clockInTime: 'some-time' };
    expect(getRawCheckOut(record)).toBeNull();
  });

  it('returns null when all checkout fields are falsy', () => {
    const record = { actualCheckOutTime: null, clockOutTime: '', checkOutTime: 0 };
    expect(getRawCheckOut(record)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCheckInTime
// ---------------------------------------------------------------------------
describe('getCheckInTime', () => {
  it('returns null for a null record', () => {
    expect(getCheckInTime(null)).toBeNull();
  });

  it('returns a Date from a record with a Firestore Timestamp clockInTime', () => {
    const d = new Date('2025-08-01T09:00:00Z');
    const record = { clockInTime: { toDate: () => d } };
    expect(getCheckInTime(record)).toBe(d);
  });

  it('returns a Date from a record with a string checkInTime', () => {
    const record = { checkInTime: '2025-08-01T09:00:00Z' };
    const result = getCheckInTime(record);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2025-08-01T09:00:00.000Z');
  });

  it('returns null when record has no check-in fields', () => {
    expect(getCheckInTime({ status: 'absent' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCheckOutTime
// ---------------------------------------------------------------------------
describe('getCheckOutTime', () => {
  it('returns null for a null record', () => {
    expect(getCheckOutTime(null)).toBeNull();
  });

  it('returns a Date from a record with a clockOutTime Date', () => {
    const d = new Date('2025-08-01T17:00:00Z');
    const record = { clockOutTime: d };
    expect(getCheckOutTime(record)).toBe(d);
  });

  it('prefers actualCheckOutTime over clockOutTime', () => {
    const actual = new Date('2025-08-01T23:59:00Z');
    const clock = new Date('2025-08-01T17:00:00Z');
    const record = {
      actualCheckOutTime: { toDate: () => actual },
      clockOutTime: { toDate: () => clock },
    };
    expect(getCheckOutTime(record)).toBe(actual);
  });

  it('returns null when record has no check-out fields', () => {
    expect(getCheckOutTime({ clockInTime: new Date() })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isCurrentlyCheckedIn
// ---------------------------------------------------------------------------
describe('isCurrentlyCheckedIn', () => {
  it('returns false for null record', () => {
    expect(isCurrentlyCheckedIn(null)).toBe(false);
  });

  it('returns false for undefined record', () => {
    expect(isCurrentlyCheckedIn(undefined)).toBe(false);
  });

  it('returns true when checked in with no check-out', () => {
    const record = { clockInTime: new Date() };
    expect(isCurrentlyCheckedIn(record)).toBe(true);
  });

  it('returns true using checkInTime (legacy field)', () => {
    const record = { checkInTime: new Date() };
    expect(isCurrentlyCheckedIn(record)).toBe(true);
  });

  it('returns false when both check-in and check-out exist', () => {
    const record = { clockInTime: new Date(), clockOutTime: new Date() };
    expect(isCurrentlyCheckedIn(record)).toBe(false);
  });

  it('returns false when neither field exists', () => {
    const record = { status: 'absent' };
    expect(isCurrentlyCheckedIn(record)).toBe(false);
  });

  it('returns false when only check-out exists (unusual)', () => {
    const record = { clockOutTime: new Date() };
    expect(isCurrentlyCheckedIn(record)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRecordCorrupted
// ---------------------------------------------------------------------------
describe('isRecordCorrupted', () => {
  it('returns false when check-in is missing', () => {
    const record = { clockOutTime: new Date() };
    expect(isRecordCorrupted(record)).toBe(false);
  });

  it('returns false when check-out is missing', () => {
    const record = { clockInTime: new Date() };
    expect(isRecordCorrupted(record)).toBe(false);
  });

  it('returns false when both are on the same day', () => {
    const record = {
      clockInTime: new Date('2025-06-15T09:00:00Z'),
      clockOutTime: new Date('2025-06-15T17:30:00Z'),
    };
    expect(isRecordCorrupted(record)).toBe(false);
  });

  it('returns true when check-in and check-out are on different days', () => {
    const record = {
      clockInTime: new Date('2025-06-15T09:00:00Z'),
      clockOutTime: new Date('2025-06-16T01:00:00Z'),
    };
    expect(isRecordCorrupted(record)).toBe(true);
  });

  it('returns false for null record (no times to compare)', () => {
    expect(isRecordCorrupted(null)).toBe(false);
  });

  it('returns true when toISOString throws on parsed dates (corrupted data)', () => {
    // We create a record whose timestamps parse to Dates but with a
    // broken toISOString (to exercise the catch branch).
    const badDate = new Date('2025-06-15T09:00:00Z');
    Object.defineProperty(badDate, 'toISOString', {
      value: () => {
        throw new Error('broken');
      },
    });
    const record = {
      clockInTime: badDate,
      clockOutTime: new Date('2025-06-15T17:00:00Z'),
    };
    expect(isRecordCorrupted(record)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatTimeHHMM
// ---------------------------------------------------------------------------
describe('formatTimeHHMM', () => {
  it('returns "N/A" for null', () => {
    expect(formatTimeHHMM(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatTimeHHMM(undefined)).toBe('N/A');
  });

  it('returns "N/A" for invalid string', () => {
    expect(formatTimeHHMM('garbage')).toBe('N/A');
  });

  it('formats a Date object to HH:mm', () => {
    const d = new Date(2025, 5, 15, 14, 5, 0); // 14:05 local time
    expect(formatTimeHHMM(d)).toBe('14:05');
  });

  it('zero-pads single-digit hours and minutes', () => {
    const d = new Date(2025, 0, 1, 8, 3, 0); // 08:03 local time
    expect(formatTimeHHMM(d)).toBe('08:03');
  });

  it('formats midnight as 00:00', () => {
    const d = new Date(2025, 0, 1, 0, 0, 0);
    expect(formatTimeHHMM(d)).toBe('00:00');
  });

  it('formats a Firestore Timestamp to HH:mm', () => {
    const d = new Date(2025, 3, 10, 9, 30, 0); // 09:30
    const ts = { toDate: () => d };
    expect(formatTimeHHMM(ts)).toBe('09:30');
  });

  it('formats a valid ISO string to HH:mm', () => {
    // Create a date string that when parsed produces a known local hour.
    const d = new Date(2025, 7, 20, 16, 45, 0);
    const result = formatTimeHHMM(d.toISOString());
    expect(result).toBe('16:45');
  });
});
