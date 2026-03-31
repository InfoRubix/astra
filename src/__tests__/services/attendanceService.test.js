/**
 * Unit tests for attendanceService.
 *
 * We mock:
 *   - firebase/firestore  (serverTimestamp, where, orderBy, limit, startAfter)
 *   - ../../services/dataService  (firestoreService)
 *   - attendanceHelpers is NOT mocked -- we use the real implementation
 */

// ---------------------------------------------------------------------------
// Mock firebase/firestore BEFORE importing anything that uses it
// ---------------------------------------------------------------------------
jest.mock('firebase/firestore', () => ({
  where: jest.fn((...args) => ({ _type: 'where', args })),
  orderBy: jest.fn((...args) => ({ _type: 'orderBy', args })),
  limit: jest.fn((n) => ({ _type: 'limit', n })),
  startAfter: jest.fn((d) => ({ _type: 'startAfter', d })),
  serverTimestamp: jest.fn(() => ({ _sentinel: 'SERVER_TIMESTAMP' })),
}));

// ---------------------------------------------------------------------------
// Mock the data service
// ---------------------------------------------------------------------------
jest.mock('../../services/dataService', () => ({
  firestoreService: {
    create: jest.fn(),
    get: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    listen: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Now import the modules under test
// ---------------------------------------------------------------------------
import { attendanceService } from '../../services/attendanceService';
import { firestoreService } from '../../services/dataService';

// ---------------------------------------------------------------------------
// Helper: suppress console noise from expected error paths
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
  // Ensure real timers are restored after every test
  jest.useRealTimers();
});

// =========================================================================
// validateClockIn
// =========================================================================
describe('attendanceService.validateClockIn', () => {
  /**
   * Helper: freeze time to a specific hour for validateClockIn tests.
   * The source code does `const now = new Date(); const currentHour = now.getHours();`
   * so we use jest fake timers to control `new Date()`.
   */
  function freezeHour(hour) {
    jest.useFakeTimers();
    // 2025-06-15 at the given local hour
    jest.setSystemTime(new Date(2025, 5, 15, hour, 0, 0));
  }

  it('returns an empty array when all required fields are present and hour is valid', () => {
    freezeHour(9);

    const data = {
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Engineering',
    };

    expect(attendanceService.validateClockIn(data)).toEqual([]);
  });

  it('returns error for missing userId', () => {
    freezeHour(9);

    const errors = attendanceService.validateClockIn({
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).toContain('User ID is required');
  });

  it('returns error for missing userName', () => {
    freezeHour(10);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).toContain('User name is required');
  });

  it('returns error for missing company', () => {
    freezeHour(10);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      department: 'Eng',
    });
    expect(errors).toContain('Company is required');
  });

  it('returns error for missing department', () => {
    freezeHour(10);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
    });
    expect(errors).toContain('Department is required');
  });

  it('returns multiple errors at once when all fields are missing', () => {
    freezeHour(10);

    const errors = attendanceService.validateClockIn({});
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors).toContain('User ID is required');
    expect(errors).toContain('User name is required');
    expect(errors).toContain('Company is required');
    expect(errors).toContain('Department is required');
  });

  it('returns an error when clock-in is before 6 AM', () => {
    freezeHour(4); // 04:00

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).toContain('Clock in outside of allowed hours (6 AM - 11 PM)');
  });

  it('returns an error when clock-in is at midnight', () => {
    freezeHour(0); // 00:00

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).toContain('Clock in outside of allowed hours (6 AM - 11 PM)');
  });

  it('allows clock-in at exactly 6 AM', () => {
    freezeHour(6);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).not.toContain('Clock in outside of allowed hours (6 AM - 11 PM)');
  });

  it('allows clock-in at 11 PM (23:00)', () => {
    freezeHour(23);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).not.toContain('Clock in outside of allowed hours (6 AM - 11 PM)');
  });

  it('allows clock-in during normal business hours (12:00)', () => {
    freezeHour(12);

    const errors = attendanceService.validateClockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });
    expect(errors).toEqual([]);
  });
});

// =========================================================================
// calculateLateStatus
// =========================================================================
describe('attendanceService.calculateLateStatus', () => {
  it('returns not late when clock-in is before the standard start', () => {
    const clockIn = new Date(2025, 5, 15, 8, 45, 0); // 08:45
    const result = attendanceService.calculateLateStatus(clockIn, '09:00');

    expect(result.isLate).toBe(false);
    expect(result.lateMinutes).toBe(0);
    expect(result.status).toBe('present');
  });

  it('returns not late when clock-in is exactly at the standard start', () => {
    const clockIn = new Date(2025, 5, 15, 9, 0, 0);
    const result = attendanceService.calculateLateStatus(clockIn, '09:00');

    expect(result.isLate).toBe(false);
    expect(result.lateMinutes).toBe(0);
    expect(result.status).toBe('present');
  });

  it('returns late when clock-in is after the standard start', () => {
    const clockIn = new Date(2025, 5, 15, 9, 15, 0); // 15 min late
    const result = attendanceService.calculateLateStatus(clockIn, '09:00');

    expect(result.isLate).toBe(true);
    expect(result.lateMinutes).toBe(15);
    expect(result.status).toBe('late');
  });

  it('handles a non-default standard start time', () => {
    const clockIn = new Date(2025, 5, 15, 8, 40, 0); // 10 min late for 08:30
    const result = attendanceService.calculateLateStatus(clockIn, '08:30');

    expect(result.isLate).toBe(true);
    expect(result.lateMinutes).toBe(10);
    expect(result.status).toBe('late');
  });

  it('uses default 09:00 start when no standard time is provided', () => {
    const clockIn = new Date(2025, 5, 15, 8, 50, 0); // early
    const result = attendanceService.calculateLateStatus(clockIn);

    expect(result.isLate).toBe(false);
    expect(result.status).toBe('present');
  });

  it('calculates large late duration correctly (90 minutes)', () => {
    const clockIn = new Date(2025, 5, 15, 10, 30, 0); // 90 min late
    const result = attendanceService.calculateLateStatus(clockIn, '09:00');

    expect(result.isLate).toBe(true);
    expect(result.lateMinutes).toBe(90);
    expect(result.status).toBe('late');
  });

  it('returns early arrival correctly with 07:00 start time', () => {
    const clockIn = new Date(2025, 5, 15, 6, 45, 0); // 15 min early
    const result = attendanceService.calculateLateStatus(clockIn, '07:00');

    expect(result.isLate).toBe(false);
    expect(result.lateMinutes).toBe(0);
    expect(result.status).toBe('present');
  });

  it('handles exactly one minute late', () => {
    const clockIn = new Date(2025, 5, 15, 9, 1, 0);
    const result = attendanceService.calculateLateStatus(clockIn, '09:00');

    expect(result.isLate).toBe(true);
    expect(result.lateMinutes).toBe(1);
    expect(result.status).toBe('late');
  });
});

// =========================================================================
// clockIn (async, requires mocking firestoreService)
// =========================================================================
describe('attendanceService.clockIn', () => {
  it('throws when validation fails (missing required fields)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 5, 15, 9, 0, 0));

    await expect(attendanceService.clockIn({})).rejects.toThrow();
  });

  it('throws when already clocked in today', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 5, 15, 9, 0, 0));

    // getTodayAttendance returns an existing record with clockInTime but no clockOutTime
    firestoreService.get.mockResolvedValue([
      { id: 'existing', clockInTime: new Date() },
    ]);

    await expect(
      attendanceService.clockIn({
        userId: 'u1',
        userName: 'Alice',
        company: 'Acme',
        department: 'Eng',
      })
    ).rejects.toThrow('Already clocked in today');
  });

  it('creates attendance record and sends notification on success', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 5, 15, 9, 0, 0));

    // No existing record today
    firestoreService.get.mockResolvedValue([]);
    firestoreService.create.mockResolvedValue('new-attendance-id');
    firestoreService.getById.mockResolvedValue({ userId: 'u1' });

    const result = await attendanceService.clockIn({
      userId: 'u1',
      userName: 'Alice',
      company: 'Acme',
      department: 'Eng',
    });

    expect(result.id).toBe('new-attendance-id');
    expect(result.status).toBe('present');
    expect(firestoreService.create).toHaveBeenCalled();
  });
});

// =========================================================================
// getTodayAttendance
// =========================================================================
describe('attendanceService.getTodayAttendance', () => {
  it('returns the first matching record', async () => {
    const record = { id: 'rec1', userId: 'u1', clockInTime: new Date() };
    firestoreService.get.mockResolvedValue([record]);

    const result = await attendanceService.getTodayAttendance('u1');
    expect(result).toEqual(record);
  });

  it('returns null when no record is found', async () => {
    firestoreService.get.mockResolvedValue([]);

    const result = await attendanceService.getTodayAttendance('u1');
    expect(result).toBeNull();
  });

  it('propagates errors from firestoreService', async () => {
    firestoreService.get.mockRejectedValue(new Error('Network error'));

    await expect(attendanceService.getTodayAttendance('u1')).rejects.toThrow('Network error');
  });
});
