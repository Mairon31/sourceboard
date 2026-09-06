import { PublicHttpError } from "../http/error";

export class ProfileError extends PublicHttpError {
  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: { retryAfter?: number } = {},
  ) {
    super(status, code, publicMessage, options);
    this.name = "ProfileError";
  }
}

export function isProfileError(error: unknown): error is ProfileError {
  return error instanceof ProfileError;
}
