export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: { retryAfter?: number } = {},
  ) {
    super(publicMessage);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfter = options.retryAfter;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
