/**
 * Retry Helper Utility
 *
 * Provides retry logic with exponential backoff for failed network operations.
 * Only retries on transient/network errors; permanent errors (auth, permission,
 * validation) are thrown immediately.
 */

/**
 * Default options for the retry mechanism.
 */
const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000,   // 1 second
  maxDelay: 10000,    // 10 seconds
  backoff: 'exponential',
};

/**
 * Error codes from Firebase/Firestore that indicate transient failures
 * and are safe to retry.
 */
const RETRYABLE_ERROR_CODES = [
  // Firestore / gRPC transient codes
  'unavailable',
  'resource-exhausted',
  'deadline-exceeded',
  'aborted',
  'internal',
  'data-loss',

  // Firebase Auth transient codes
  'auth/network-request-failed',
  'auth/timeout',

  // Firestore-specific transient codes
  'firestore/unavailable',
  'firestore/deadline-exceeded',
  'firestore/aborted',
  'firestore/resource-exhausted',
  'firestore/internal',
];

/**
 * Error codes that should NOT be retried because they indicate permanent
 * failures that will not resolve on their own.
 */
const NON_RETRYABLE_ERROR_CODES = [
  // Permission / auth errors
  'permission-denied',
  'unauthenticated',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/email-already-in-use',
  'auth/invalid-email',
  'auth/user-disabled',
  'auth/requires-recent-login',
  'auth/invalid-credential',

  // Not found / validation errors
  'not-found',
  'already-exists',
  'invalid-argument',
  'failed-precondition',
  'out-of-range',
  'unimplemented',
  'cancelled',
];

/**
 * Network-related error messages (substring matches) that indicate
 * transient failures worth retrying.
 */
const RETRYABLE_ERROR_MESSAGES = [
  'network error',
  'network request failed',
  'failed to fetch',
  'load failed',
  'networkerror',
  'timeout',
  'econnrefused',
  'econnreset',
  'econnaborted',
  'enotfound',
  'epipe',
  'socket hang up',
  'dns lookup failed',
  'err_network',
  'err_connection',
  'err_timed_out',
  'err_internet_disconnected',
  'the internet connection appears to be offline',
  'a network error occurred',
  'could not connect to the server',
];

/**
 * Determines whether an error is retryable (transient/network) or permanent.
 *
 * @param {Error} error - The error to evaluate.
 * @returns {boolean} True if the error is retryable, false otherwise.
 */
function isRetryableError(error) {
  if (!error) {
    return false;
  }

  // Check the error code against known non-retryable codes first
  const errorCode = error.code || error.errorCode || '';
  if (typeof errorCode === 'string' && errorCode.length > 0) {
    const normalizedCode = errorCode.toLowerCase();

    // Explicitly non-retryable
    if (NON_RETRYABLE_ERROR_CODES.some(code => normalizedCode.includes(code.toLowerCase()))) {
      return false;
    }

    // Explicitly retryable by code
    if (RETRYABLE_ERROR_CODES.some(code => normalizedCode.includes(code.toLowerCase()))) {
      return true;
    }
  }

  // Check HTTP status codes if available
  const status = error.status || error.httpStatus || error.statusCode;
  if (typeof status === 'number') {
    // 4xx client errors are generally not retryable (except 408 Request Timeout and 429 Too Many Requests)
    if (status === 408 || status === 429) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
    // 5xx server errors are retryable
    if (status >= 500) {
      return true;
    }
  }

  // Check error message for network-related patterns
  const errorMessage = (error.message || '').toLowerCase();
  if (RETRYABLE_ERROR_MESSAGES.some(msg => errorMessage.includes(msg))) {
    return true;
  }

  // TypeError with "Failed to fetch" indicates a network issue in browsers
  if (error instanceof TypeError && errorMessage.includes('fetch')) {
    return true;
  }

  // If we cannot determine the nature of the error, do not retry
  return false;
}

/**
 * Calculates the delay before the next retry attempt.
 *
 * @param {number} attempt - The current retry attempt number (0-indexed).
 * @param {object} options - The retry options.
 * @returns {number} Delay in milliseconds.
 */
function calculateDelay(attempt, options) {
  const { baseDelay, maxDelay, backoff } = options;
  let delay;

  if (backoff === 'exponential') {
    // Exponential backoff: baseDelay * 2^attempt
    delay = baseDelay * Math.pow(2, attempt);
  } else if (backoff === 'linear') {
    // Linear backoff: baseDelay * (attempt + 1)
    delay = baseDelay * (attempt + 1);
  } else {
    // Fixed delay
    delay = baseDelay;
  }

  // Add jitter (random factor between 0-25% of the delay) to prevent thundering herd
  const jitter = delay * 0.25 * Math.random();
  delay = delay + jitter;

  // Cap at maxDelay
  return Math.min(delay, maxDelay);
}

/**
 * Pauses execution for the specified duration.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 * Only retries on network/transient errors; auth and permission errors
 * are thrown immediately.
 *
 * @param {Function} fn - The async function to execute with retry logic.
 * @param {object} [options] - Configuration options.
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [options.baseDelay=1000] - Base delay in ms before the first retry.
 * @param {number} [options.maxDelay=10000] - Maximum delay in ms between retries.
 * @param {string} [options.backoff='exponential'] - Backoff strategy: 'exponential', 'linear', or 'fixed'.
 * @param {Function} [options.onRetry] - Optional callback invoked before each retry with (error, attempt).
 * @returns {Promise<*>} The result of the function if it succeeds within the allowed retries.
 * @throws {Error} The last error encountered if all retries are exhausted, or a
 *   non-retryable error immediately.
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, onRetry } = config;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // If the error is not retryable, throw immediately
      if (!isRetryableError(error)) {
        throw error;
      }

      // If we have exhausted all retries, throw the last error
      if (attempt >= maxRetries) {
        const retryError = new Error(
          `Operation failed after ${maxRetries} retries: ${error.message}`
        );
        retryError.originalError = error;
        retryError.code = error.code;
        retryError.attempts = attempt + 1;
        throw retryError;
      }

      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempt, config);

      // Invoke optional onRetry callback
      if (typeof onRetry === 'function') {
        try {
          onRetry(error, attempt + 1);
        } catch (_) {
          // Ignore errors in the onRetry callback
        }
      }

      console.warn(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms - Error: ${error.message || error.code || 'Unknown error'}`
      );

      await sleep(delay);
    }
  }

  // Fallback (should not be reached)
  throw lastError;
}

export { withRetry, isRetryableError };
