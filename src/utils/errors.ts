// src/utils/errors.ts
import { logger } from './logger';

export class OptimizerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'OptimizerError';
  }
}

export class ValidationError extends OptimizerError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class FileSystemError extends OptimizerError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'FILESYSTEM_ERROR', context);
    this.name = 'FileSystemError';
  }
}

export class NetworkError extends OptimizerError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export class ParseError extends OptimizerError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PARSE_ERROR', context);
    this.name = 'ParseError';
  }
}

export function handleError(error: unknown, context: string): OptimizerError {
  if (error instanceof OptimizerError) {
    return error;
  }

  if (error instanceof Error) {
    logger.error(`Error in ${context}: ${error.message}`, { stack: error.stack });
    return new OptimizerError(error.message, 'UNKNOWN_ERROR', { originalError: error });
  }

  const message = `Unknown error in ${context}: ${String(error)}`;
  logger.error(message);
  return new OptimizerError(message, 'UNKNOWN_ERROR', { originalError: error });
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries - 1) {
        break;
      }

      const delay = baseDelay * Math.pow(backoffMultiplier, attempt);
      logger.debug(`Retry attempt ${attempt + 1} failed, waiting ${delay}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
