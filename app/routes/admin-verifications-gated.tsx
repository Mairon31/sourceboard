import type { ServerLoaderArgs } from "../data/server-request";
import { requireAdminPageAccess } from "../data/admin-access";
import AdminVerificationsRoute, { loader as loadAdminVerifications } from "./admin-verifications";

export async function loader(args: ServerLoaderArgs) {
  await requireAdminPageAccess(args.request, args.context);
  return loadAdminVerifications(args);
}

export default AdminVerificationsRoute;
