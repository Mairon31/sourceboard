export interface PublicHttpErrorOptions {
  retryAfter?: number;
}

export class PublicHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: PublicHttpErrorOptions = {},
  ) {
    super(publicMessage);
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfter = options.retryAfter;
  }
}
