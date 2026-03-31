/**
 * Unit tests for useApprovalHandler hook.
 *
 * We mock:
 *   - firebase/firestore  (updateDoc, doc, serverTimestamp, addDoc, collection)
 *   - ../services/firebase (db)
 *   - ../contexts/AuthContext (useAuth)
 */
import { renderHook, act } from '@testing-library/react';
import { useApprovalHandler } from '../../hooks/useApprovalHandler';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockDoc = jest.fn((_db, collectionName, id) => `ref:${collectionName}/${id}`);
const mockCollection = jest.fn((_db, name) => `col:${name}`);

jest.mock('firebase/firestore', () => ({
  updateDoc: (...args) => mockUpdateDoc(...args),
  doc: (...args) => mockDoc(...args),
  serverTimestamp: jest.fn(() => ({ _sentinel: 'SERVER_TIMESTAMP' })),
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
}));

jest.mock('../../services/firebase', () => ({
  db: 'mock-db',
}));

const mockUser = {
  uid: 'admin-123',
  firstName: 'John',
  lastName: 'Admin',
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

// Re-import useAuth so we can change the return value per-test
import { useAuth } from '../../contexts/AuthContext';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  // Reset useAuth to the default mock user
  useAuth.mockReturnValue({ user: mockUser });
  // Default: both Firestore writes succeed
  mockUpdateDoc.mockResolvedValue(undefined);
  mockAddDoc.mockResolvedValue({ id: 'notif-1' });

  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});

// =========================================================================
// Basic hook shape
// =========================================================================
describe('useApprovalHandler - basics', () => {
  it('returns handleApproval function and actionLoading boolean', () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));
    expect(typeof result.current.handleApproval).toBe('function');
    expect(result.current.actionLoading).toBe(false);
  });
});

// =========================================================================
// Approval flow
// =========================================================================
describe('useApprovalHandler - approval flow', () => {
  it('approves an item and creates a notification', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval(
        'claim-42',
        'approve',
        'Looks good',
        { userId: 'user-789', processedAmount: 150 }
      );
    });

    expect(outcome).toEqual({ success: true });

    // 1) Firestore document was updated
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload.status).toBe('approved');
    expect(updatePayload.approvedBy).toBe('John Admin');
    expect(updatePayload.approvedById).toBe('admin-123');
    expect(updatePayload.adminComments).toBe('Looks good');
    expect(updatePayload.processedAmount).toBe(150);

    // 2) Notification was created
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const notifPayload = mockAddDoc.mock.calls[0][1];
    expect(notifPayload.userId).toBe('user-789');
    expect(notifPayload.title).toBe('Claim Approved');
    expect(notifPayload.message).toContain('approved');
    expect(notifPayload.message).toContain('John Admin');
    expect(notifPayload.read).toBe(false);

    // 3) Loading is reset
    expect(result.current.actionLoading).toBe(false);
  });

  it('sets default adminComments when reason is empty on approval', async () => {
    const { result } = renderHook(() => useApprovalHandler('leaves'));

    await act(async () => {
      await result.current.handleApproval('leave-1', 'approve', '', {
        userId: 'user-1',
      });
    });

    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload.adminComments).toBe('Approved by John Admin');
  });
});

// =========================================================================
// Rejection flow
// =========================================================================
describe('useApprovalHandler - rejection flow', () => {
  it('rejects an item and includes rejection reason', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval(
        'claim-99',
        'reject',
        'Insufficient documentation',
        { userId: 'user-555' }
      );
    });

    expect(outcome).toEqual({ success: true });

    // 1) Document updated with rejection fields
    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload.status).toBe('rejected');
    expect(updatePayload.rejectedBy).toBe('John Admin');
    expect(updatePayload.rejectedById).toBe('admin-123');
    expect(updatePayload.rejectionReason).toBe('Insufficient documentation');
    // Should NOT have adminComments (that is for approvals)
    expect(updatePayload.adminComments).toBeUndefined();

    // 2) Notification includes the reason
    const notifPayload = mockAddDoc.mock.calls[0][1];
    expect(notifPayload.title).toBe('Claim Rejected');
    expect(notifPayload.message).toContain('rejected');
    expect(notifPayload.message).toContain('Insufficient documentation');
  });

  it('rejection without a reason omits rejectionReason from payload', async () => {
    const { result } = renderHook(() => useApprovalHandler('leaves'));

    await act(async () => {
      await result.current.handleApproval('leave-5', 'reject', '', {
        userId: 'user-10',
      });
    });

    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload.rejectionReason).toBeUndefined();
  });
});

// =========================================================================
// Error handling
// =========================================================================
describe('useApprovalHandler - error handling', () => {
  it('returns error when itemId is missing', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval(null, 'approve', 'ok');
    });

    expect(outcome).toEqual({ success: false, error: 'No item ID provided' });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('returns error when itemId is undefined', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval(undefined, 'approve', 'ok');
    });

    expect(outcome).toEqual({ success: false, error: 'No item ID provided' });
  });

  it('returns error when itemId is empty string', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval('', 'approve', 'ok');
    });

    expect(outcome).toEqual({ success: false, error: 'No item ID provided' });
  });

  it('returns error when user is not authenticated', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval('claim-1', 'approve', 'ok');
    });

    expect(outcome).toEqual({
      success: false,
      error: 'User not authenticated',
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('returns error when Firestore updateDoc fails', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('Firestore write failed'));

    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval('claim-1', 'approve', 'ok', {
        userId: 'user-1',
      });
    });

    expect(outcome).toEqual({
      success: false,
      error: 'Firestore write failed',
    });
    // Loading should be reset after error
    expect(result.current.actionLoading).toBe(false);
  });

  it('returns error when addDoc (notification creation) fails', async () => {
    mockAddDoc.mockRejectedValue(new Error('Notification write failed'));

    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval('claim-1', 'approve', 'ok', {
        userId: 'user-1',
      });
    });

    expect(outcome).toEqual({
      success: false,
      error: 'Notification write failed',
    });
    expect(result.current.actionLoading).toBe(false);
  });

  it('skips notification creation when no userId is provided', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    let outcome;
    await act(async () => {
      outcome = await result.current.handleApproval('claim-1', 'approve', 'ok', {});
    });

    expect(outcome).toEqual({ success: true });
    // Document was updated
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    // But no notification was created
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

// =========================================================================
// Notification targeting via _notifyUserId
// =========================================================================
describe('useApprovalHandler - _notifyUserId', () => {
  it('uses _notifyUserId for notification when provided', async () => {
    const { result } = renderHook(() => useApprovalHandler('leaves'));

    await act(async () => {
      await result.current.handleApproval('leave-1', 'approve', 'OK', {
        _notifyUserId: 'target-user-888',
        userId: 'should-not-be-used',
      });
    });

    const notifPayload = mockAddDoc.mock.calls[0][1];
    expect(notifPayload.userId).toBe('target-user-888');
  });
});

// =========================================================================
// Collection name handling
// =========================================================================
describe('useApprovalHandler - collection name handling', () => {
  it('works with "leaves" collection and generates correct notification title', async () => {
    const { result } = renderHook(() => useApprovalHandler('leaves'));

    await act(async () => {
      await result.current.handleApproval('leave-1', 'approve', 'Approved', {
        userId: 'user-1',
      });
    });

    const notifPayload = mockAddDoc.mock.calls[0][1];
    expect(notifPayload.title).toBe('Leave Approved');
    expect(notifPayload.type).toBe('leave_update');
  });

  it('works with "claims" collection and generates correct notification title', async () => {
    const { result } = renderHook(() => useApprovalHandler('claims'));

    await act(async () => {
      await result.current.handleApproval('claim-1', 'reject', 'No receipts', {
        userId: 'user-2',
      });
    });

    const notifPayload = mockAddDoc.mock.calls[0][1];
    expect(notifPayload.title).toBe('Claim Rejected');
    expect(notifPayload.type).toBe('claim_update');
  });
});
