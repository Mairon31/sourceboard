/**
 * The Phase 1 binding contract is deliberately optional at the application
 * boundary. Local development can start without remote provisioning, while
 * services that need a binding receive it as a required constructor argument.
 */
export interface SourceBoardEnvironment {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  CACHE?: KVNamespace;
  EVENTS?: Queue;
  RATE_LIMIT_AUTH?: RateLimit;
  RATE_LIMIT_CONTENT?: RateLimit;
  RATE_LIMIT_REACTIONS?: RateLimit;
  RATE_LIMIT_UPLOADS?: RateLimit;
  EMAIL?: SendEmail;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}
