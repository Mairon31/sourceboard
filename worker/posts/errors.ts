import { PublicHttpError } from "../http/error";

export class PostError extends PublicHttpError {
  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: { retryAfter?: number } = {},
  ) {
    super(status, code, publicMessage, options);
    this.name = "PostError";
  }
}

export function isPostError(error: unknown): error is PostError {
  return error instanceof PostError;
}
