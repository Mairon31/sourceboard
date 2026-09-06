export class SearchError extends Error {
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
    this.name = "SearchError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfter = options.retryAfter;
  }
}

export function isSearchError(error: unknown): error is SearchError {
  return error instanceof SearchError;
}
