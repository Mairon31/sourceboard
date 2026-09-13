import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const DIRECT_ADMIN_ROUTES = [
  "app/routes/admin.tsx",
  "app/routes/admin-moderation.tsx",
  "app/routes/admin-users.tsx",
  "app/routes/admin-roles.tsx",
  "app/routes/admin-reputation.tsx",
  "app/routes/admin-store.tsx",
  "app/routes/admin-content.tsx",
  "app/routes/admin-content-page.tsx",
  "app/routes/admin-audit.tsx",
  "app/routes/admin-anonymous.tsx",
] as const;

describe("admin route zero-flash guard", () => {
  it("requires the shared admin guard in every direct admin loader", () => {
    for (const route of DIRECT_ADMIN_ROUTES) {
      const source = read(route);
      expect(source, route).toContain("requireAdminPageAccess");
      expect(source, route).not.toContain("loadAdminAccess(request, context)");
    }
  });

  it("routes source integrity and its legacy alias through a guarded loader", () => {
    const routes = read("app/routes.ts");
    const wrapper = read("app/routes/admin-verifications-gated.tsx");
    expect(routes).toContain('route("admin/source-integrity", "routes/admin-verifications-gated.tsx"');
    expect(routes).toContain('route("admin/verifications", "routes/admin-verifications-gated.tsx"');
    expect(wrapper).toContain("requireAdminPageAccess(args.request, args.context)");
    expect(wrapper.indexOf("requireAdminPageAccess")).toBeLessThan(wrapper.indexOf("loadAdminVerifications(args)"));
  });

  it("keeps the visual guard semantics server-side", () => {
    const guard = read("app/data/admin-access.ts");
    expect(guard).toContain('throw redirect(`/login?${search.toString()}`)');
    expect(guard).toContain('hasCapability(authorization, "admin.access")');
    expect(guard).toContain('new Response("", { status: 404 })');
  });
});
