interface NotificationHubNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

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
  NOTIFICATION_HUB?: NotificationHubNamespace;
  RATE_LIMIT_AUTH?: RateLimit;
  RATE_LIMIT_CONTENT?: RateLimit;
  RATE_LIMIT_REACTIONS?: RateLimit;
  RATE_LIMIT_UPLOADS?: RateLimit;
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;
  EMAIL_LOOKUP_KEY_V1?: string;
  DATA_ENCRYPTION_KEY_V1?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}
