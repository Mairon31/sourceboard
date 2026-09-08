export interface PreferenceChangeOptions<T> {
  previous: T;
  next: T;
  apply(value: T): void;
  persist(value: T): Promise<boolean>;
}

export async function persistPreferenceChange<T>(
  options: PreferenceChangeOptions<T>,
): Promise<boolean> {
  options.apply(options.next);
  try {
    if (await options.persist(options.next)) return true;
  } catch {
    // Restore the authoritative value below when the request fails.
  }
  options.apply(options.previous);
  return false;
}
