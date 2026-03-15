/**
 * Error-related types for Tushare module
 */

// ============================================================================
// Error Interfaces
// ============================================================================

/**
 * Tushare API error
 */
export interface TushareApiError {
  /** Error code from Tushare API */
  code: number;
  /** Error message */
  message: string;
  /** API endpoint that failed */
  apiName: string;
}

/**
 * Error context for debugging
 */
export interface ErrorContext {
  /** API endpoint name */
  apiName: string;
  /** Request parameters */
  params: Record<string, any>;
  /** Attempt number (for retries) */
  attempt: number;
  /** Additional context */
  [key: string]: any;
}

/**
 * Custom error class for Tushare module
 */
export class TushareError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TushareError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error type categories
 */
export enum ErrorType {
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  API_ERROR = 'api_error',
  SERVER_ERROR = 'server_error',
  RESPONSE_ERROR = 'response_error',
}
