import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApiErrorCode, type ApiErrorBody } from '@org/types';
import type { Request, Response } from 'express';
import { describePrismaError, isPrismaError } from './prisma-errors.js';

/** Maps HTTP status to the stable error code the client switches on. */
const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ApiErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RATE_LIMITED,
};

interface StructuredErrorPayload {
  code?: ApiErrorCode;
  message?: string | string[];
  errors?: Record<string, string[]>;
}

/**
 * Normalises every thrown error into a single response shape.
 *
 * Without this, Nest emits three different body shapes (string, object,
 * validation array) and the client ends up guessing. Unexpected errors are
 * logged with their stack but reported to the caller without internals.
 * Prisma constraint failures a service did not handle are the caller's 4xx,
 * not a server fault, so a duplicate or stale id can never surface as a 500.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const prismaError = isHttp ? null : describePrismaError(exception);
    const status = isHttp
      ? exception.getStatus()
      : (prismaError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    let code = STATUS_TO_CODE[status] ?? ApiErrorCode.INTERNAL;
    let message = 'An unexpected error occurred.';
    let errors: Record<string, string[]> | undefined;

    if (isHttp) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else {
        const structured = payload as StructuredErrorPayload;
        if (structured.code) code = structured.code;
        if (structured.errors) errors = structured.errors;
        message = Array.isArray(structured.message)
          ? structured.message.join(', ')
          : (structured.message ?? exception.message);
      }
    } else if (prismaError) {
      message = prismaError.message;
      errors = prismaError.errors;
      // Still logged: an unhandled one usually marks a missing check to add.
      if (isPrismaError(exception)) {
        this.logger.warn(
          `${request.method} ${request.url} -> ${status} (${exception.code}: ${message})`,
        );
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
