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
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

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
