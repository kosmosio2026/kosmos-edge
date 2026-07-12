export interface ApiSuccessResponse<T> {
  ok: true;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}