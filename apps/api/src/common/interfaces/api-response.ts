import { ApiSuccessResponse } from '../interfaces/api-response.interface';

export function successResponse<T>(
  code: string,
  message: string,
  data: T,
): ApiSuccessResponse<T> {
  return {
    ok: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}