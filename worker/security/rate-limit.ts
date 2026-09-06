export interface RateLimitFailureFactories {
  unavailable: () => Error;
  limited: () => Error;
}

/**
 * Fail closed when a production Rate Limiting binding is missing. Callers
 * provide their domain error so the public envelope remains stable per API.
 */
export async function enforceRateLimit(
  binding: RateLimit | undefined,
  key: string,
  failures: RateLimitFailureFactories,
): Promise<void> {
  if (!binding) throw failures.unavailable();
  let result: RateLimitOutcome;
  try {
    result = await binding.limit({ key });
  } catch {
    throw failures.unavailable();
  }
  if (!result.success) throw failures.limited();
}
