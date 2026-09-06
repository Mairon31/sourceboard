import { createAuthContext, createAuthService } from "../../worker/auth/service";
import { hasCapability } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "./server-request";

export interface AdminAccessResult {
  authorized: boolean;
  unavailable: boolean;
}

export async function loadAdminAccess(
  request: Request,
  context: ServerLoaderArgs["context"],
): Promise<AdminAccessResult> {
  return withOptionalServerSession(
    request,
    context,
    () => ({ authorized: false, unavailable: false }),
    async (runtime, userId) => {
      if (!userId) return { authorized: false, unavailable: false };
      const auth = createAuthService({
        store: createD1AuthStore(runtime.db),
        env: runtime.env,
      });
      const authorization = await auth.getAuthorization(
        createAuthContext(request, crypto.randomUUID()),
      );
      return {
        authorized: hasCapability(authorization, "admin.access"),
        unavailable: false,
      };
    },
  );
}
