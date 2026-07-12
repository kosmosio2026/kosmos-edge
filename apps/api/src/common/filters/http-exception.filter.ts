import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';
import { ErrorCodes } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string = ErrorCodes.COMMON_INTERNAL_ERROR;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = mapStatusToErrorCode(status);
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? body.message.join(', ')
              : message;
        code =
          typeof body.code === 'string'
            ? body.code
            : mapStatusToErrorCode(status);
        details = body;
      } else {
        code = mapStatusToErrorCode(status);
      }
    }

    const payload: ApiErrorResponse = {
      ok: false,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }
}

function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCodes.COMMON_BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCodes.COMMON_UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCodes.COMMON_FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCodes.COMMON_NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCodes.COMMON_CONFLICT;
    default:
      return ErrorCodes.COMMON_INTERNAL_ERROR;
  }
}