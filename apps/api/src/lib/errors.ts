import { ErrorCode, type ApiErrorBody } from "@xs-share/shared";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly status: number;

  constructor(
    code: ErrorCode,
    message: string,
    status = 400,
    messageKey = `errors.${code.toLowerCase()}`,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.messageKey = messageKey;
  }

  toBody(): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      messageKey: this.messageKey,
    };
  }
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
}

export function forbidden(message = "Forbidden") {
  return new AppError(ErrorCode.FORBIDDEN, message, 403);
}

export function notFound(message = "Not found") {
  return new AppError(ErrorCode.NOT_FOUND, message, 404);
}

export function conflict(message: string, code: ErrorCode = ErrorCode.CONFLICT) {
  return new AppError(code, message, 409);
}

export function validation(message: string) {
  return new AppError(ErrorCode.VALIDATION, message, 400);
}
