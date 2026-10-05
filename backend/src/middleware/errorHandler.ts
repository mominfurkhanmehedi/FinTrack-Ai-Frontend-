import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(message, 409, 'CONFLICT', details);
  }

  static internal(message: string = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(message, 500, 'INTERNAL_ERROR', details);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): ApiError {
    return new ApiError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
  meta?: {
    timestamp: string;
    path: string;
    method: string;
  };
}

export function successResponse<T>(data: T, res: Response, statusCode: number = 200): Response<ApiResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      path: res.req.path,
      method: res.req.method,
    },
  });
}

export function errorResponse(err: AppError | Error, res: Response, statusCode: number = 500): Response<ApiResponse> {
  const isApiError = err instanceof ApiError;
  return res.status(isApiError ? err.statusCode : statusCode).json({
    success: false,
    error: err.message,
    code: isApiError ? err.code : 'INTERNAL_ERROR',
    details: isApiError ? err.details : undefined,
    meta: {
      timestamp: new Date().toISOString(),
      path: res.req.path,
      method: res.req.method,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): Response<ApiResponse> {
  return errorResponse(
    new ApiError(`Route ${req.method} ${req.path} not found`, 404, 'NOT_FOUND'),
    res,
    404
  );
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): Response<ApiResponse> {
  if (err instanceof ZodError) {
    return errorResponse(
      ApiError.badRequest('Validation failed', err.errors),
      res,
      400
    );
  }

  if (err instanceof ApiError) {
    return errorResponse(err, res, err.statusCode);
  }

  console.error('Unhandled error:', err);

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return errorResponse(ApiError.unauthorized('Invalid or expired token'), res, 401);
  }

  return errorResponse(
    ApiError.internal('An unexpected error occurred'),
    res,
    500
  );
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
