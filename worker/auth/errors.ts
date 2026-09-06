import { PublicHttpError } from "../http/error";

export class AuthError extends PublicHttpError {
  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: { retryAfter?: number } = {},
  ) {
    super(status, code, publicMessage, options);
    this.name = "AuthError";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
