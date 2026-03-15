/**
 * Error handling for Tushare API
 * 
 * Provides centralized error classification, retry logic, and descriptive error messages
 * for all Tushare API interactions.
 */

/**
 * Custom error class for Tushare-specific errors
 */
export class TushareError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TushareError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to structured object format
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      suggestion: this.suggestion,
      context: this.context,
    };
  }
}

/**
 * Tushare API error response structure
 */
export interface TushareApiError {
  code: number;
  message: string;
  apiName: string;
}

/**
 * Context information for error handling
 */
export interface ErrorContext {
  apiName: string;
  params: Record<string, any>;
  attempt: number;
  timestamp?: Date;
}

/**
 * Error type classification
 */
export enum ErrorType {
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  API = 'api',
  SERVER = 'server',
  RESPONSE = 'response',
}

/**
 * Error handler for Tushare API
 */
export class ErrorHandler {
  /**
   * Classify error type based on error characteristics
   */
  classifyError(error: any): ErrorType {
    // Configuration errors (missing token, etc.)
    if (error.message?.includes('TUSHARE_API_KEY') || error.code === 'MISSING_TOKEN') {
      return ErrorType.CONFIGURATION;
    }

    // Validation errors (invalid input)
    if (
      error.code?.startsWith('INVALID_') ||
      error.message?.includes('Invalid') ||
      error.message?.includes('validation')
    ) {
      return ErrorType.VALIDATION;
    }

    // Rate limit errors
    if (
      error.status === 429 ||
      error.code === 429 ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests') ||
      error.message?.includes('请求过于频繁')
    ) {
      return ErrorType.RATE_LIMIT;
    }

    // Network errors (timeout, connection failure)
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network')
    ) {
      return ErrorType.NETWORK;
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return ErrorType.SERVER;
    }

    // API errors (Tushare-specific error codes)
    if (error.code && typeof error.code === 'number' && error.code !== 0) {
      return ErrorType.API;
    }

    // Response errors (invalid JSON, missing fields)
    if (
      error.message?.includes('JSON') ||
      error.message?.includes('parse') ||
      error.message?.includes('schema')
    ) {
      return ErrorType.RESPONSE;
    }

    // Default to API error
    return ErrorType.API;
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= 3) {
      return false;
    }

    const errorType = this.classifyError(error);

    // Retry network errors
    if (errorType === ErrorType.NETWORK) {
      return true;
    }

    // Retry rate limit errors
    if (errorType === ErrorType.RATE_LIMIT) {
      return true;
    }

    // Retry server errors
    if (errorType === ErrorType.SERVER) {
      return true;
    }

    // Don't retry configuration, validation, API, or response errors
    return false;
  }

  /**
   * Get retry delay with exponential backoff
   * Returns delay in milliseconds: 1s, 2s, 4s
   */
  getRetryDelay(attempt: number, error?: any): number {
    // Check for rate limit retry-after header
    if (error?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000;
      }
    }

    // Exponential backoff: 2^attempt * 1000ms
    return Math.pow(2, attempt) * 1000;
  }

  /**
   * Format error message with context and suggestions
   */
  formatErrorMessage(error: any, context: ErrorContext): string {
    const errorType = this.classifyError(error);
    const { apiName, params, attempt } = context;

    switch (errorType) {
      case ErrorType.CONFIGURATION:
        return this.formatConfigurationError(error);

      case ErrorType.VALIDATION:
        return this.formatValidationError(error, apiName, params);

      case ErrorType.NETWORK:
        return this.formatNetworkError(error, apiName, attempt);

      case ErrorType.RATE_LIMIT:
        return this.formatRateLimitError(error, apiName);

      case ErrorType.API:
        return this.formatApiError(error, apiName, params);

      case ErrorType.SERVER:
        return this.formatServerError(error, apiName);

      case ErrorType.RESPONSE:
        return this.formatResponseError(error, apiName);

      default:
        return `Tushare API error in ${apiName}: ${error.message || 'Unknown error'}`;
    }
  }

  /**
   * Format configuration error message
   */
  private formatConfigurationError(error: any): string {
    if (error.message?.includes('TUSHARE_API_KEY') || error.code === 'MISSING_TOKEN') {
      return 'TUSHARE_API_KEY environment variable is not set. Please set it to your Tushare API token.';
    }
    return `Configuration error: ${error.message}`;
  }

  /**
   * Format validation error message
   */
  private formatValidationError(error: any, apiName: string, params: Record<string, any>): string {
    const paramStr = JSON.stringify(params, null, 2);
    return `Validation error in ${apiName}: ${error.message}\nParameters: ${paramStr}`;
  }

  /**
   * Format network error message
   */
  private formatNetworkError(error: any, apiName: string, attempt: number): string {
    const timeout = error.timeout || 30000;
    return `Network error in ${apiName} (attempt ${attempt}/3): ${error.message}. Timeout: ${timeout}ms`;
  }

  /**
   * Format rate limit error message
   */
  private formatRateLimitError(error: any, apiName: string): string {
    const retryAfter = error.headers?.['retry-after'];
    const retryMsg = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
    return `Rate limit exceeded for ${apiName}.${retryMsg} Please reduce request frequency.`;
  }

  /**
   * Format API error message
   */
  private formatApiError(error: any, apiName: string, params: Record<string, any>): string {
    const code = error.code || 'unknown';
    const message = error.message || 'Unknown API error';
    const paramStr = JSON.stringify(params, null, 2);
    return `Tushare API error in ${apiName} (code: ${code}): ${message}\nParameters: ${paramStr}`;
  }

  /**
   * Format server error message
   */
  private formatServerError(error: any, apiName: string): string {
    const status = error.status || '5xx';
    return `Server error in ${apiName} (HTTP ${status}): ${error.message || 'Internal server error'}. The Tushare API may be experiencing issues.`;
  }

  /**
   * Format response error message
   */
  private formatResponseError(error: any, apiName: string): string {
    return `Invalid response from ${apiName}: ${error.message}. The API response format may have changed.`;
  }

  /**
   * Get actionable suggestion for error
   */
  getSuggestion(error: any, context: ErrorContext): string | undefined {
    const errorType = this.classifyError(error);

    switch (errorType) {
      case ErrorType.CONFIGURATION:
        return 'Set the TUSHARE_API_KEY environment variable with your API token from https://tushare.pro';

      case ErrorType.VALIDATION:
        if (error.code === 'INVALID_STOCK_CODE') {
          return 'Use get_cn_stock_list or get_hk_stock_list to find the correct stock code';
        }
        if (error.code === 'INVALID_DATE') {
          return 'Use YYYYMMDD format for dates (e.g., 20240101)';
        }
        if (error.code === 'INVALID_DATE_RANGE') {
          return 'Ensure start_date is before or equal to end_date';
        }
        return 'Check the input parameters and try again';

      case ErrorType.NETWORK:
        return 'Check your internet connection and try again';

      case ErrorType.RATE_LIMIT:
        return 'Wait a few seconds and try again, or reduce request frequency';

      case ErrorType.SERVER:
        return 'Wait a moment and try again. If the issue persists, check Tushare API status';

      case ErrorType.RESPONSE:
        return 'This may indicate an API change. Please report this issue';

      default:
        return undefined;
    }
  }

  /**
   * Handle API error and throw TushareError
   */
  handleApiError(error: any, context: ErrorContext): never {
    const message = this.formatErrorMessage(error, context);
    const errorType = this.classifyError(error);
    const suggestion = this.getSuggestion(error, context);

    throw new TushareError(
      message,
      errorType,
      suggestion,
      {
        ...context,
        originalError: error.message,
        timestamp: new Date(),
      }
    );
  }
}

/**
 * Singleton error handler instance
 */
export const errorHandler = new ErrorHandler();
