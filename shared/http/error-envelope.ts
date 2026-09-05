export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function createErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      requestId,
    },
  };
}
