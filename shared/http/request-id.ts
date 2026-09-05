import { requestIdSchema } from "../schemas/common";

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(
  headers: Headers,
  generate: () => string = () => crypto.randomUUID(),
): string {
  const inbound = headers.get(REQUEST_ID_HEADER);
  const parsed = requestIdSchema.safeParse(inbound);

  return parsed.success ? parsed.data : generate();
}
