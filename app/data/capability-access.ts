import { hasCapability, type Capability } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "./server-request";

export async function loadCapabilityAccess(
  request: Request,
  context: ServerLoaderArgs["context"],
  capability: Capability,
) {
  return withOptionalServerSession(
    request,
    context,
    () => ({ authorized: false, unavailable: false }),
    async (runtime, userId) => {
      if (!userId) return { authorized: false, unavailable: false };
      const authorization = await createD1AuthStore(runtime.db).getAuthorization(userId);
      return { authorized: hasCapability(authorization, capability), unavailable: false };
    },
  );
}
