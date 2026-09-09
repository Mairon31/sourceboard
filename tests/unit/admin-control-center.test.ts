import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const adminRead = read("../../worker/admin/read.ts");
const adminTypes = read("../../worker/admin/types.ts");
const shell = read("../../app/components/admin/AdminShell.tsx");
const css = read("../../app/components/admin/admin.css");
const routes = read("../../app/routes.ts");
const adminRoute = read("../../app/routes/admin.tsx");
const moderationRoute = read("../../app/routes/admin-moderation.tsx");
const verificationsRoute = read("../../app/routes/admin-verifications.tsx");
const usersRoute = read("../../app/routes/admin-users.tsx");
const rolesRoute = read("../../app/routes/admin-roles.tsx");
const auditRoute = read("../../app/routes/admin-audit.tsx");

describe("admin control center", () => {
  it("provides typed overview users roles and audit reads", () => {
    expect(adminTypes).toContain("AdminOverviewSnapshot");
    expect(adminTypes).toContain("AdminUserRow");
    expect(adminTypes).toContain("AdminRoleRow");
    expect(adminTypes).toContain("AdminAuditRow");
    expect(adminRead).toContain("createAdminReadService");
  });

  it("uses dedicated admin routes and responsive admin navigation", () => {
    expect(shell).toContain('href: "/admin/users"');
    expect(shell).toContain('href: "/admin/roles"');
    expect(shell).toContain('href: "/admin/audit"');
    expect(css).toContain("admin-mobile-card-list");
  });

  it("renders real overview metrics and recent audit from the admin read service", () => {
    expect(adminRoute).toContain("createAdminReadService");
    expect(adminRoute).toContain(".overview()");
    expect(adminRoute).toContain("AdminMetric");
    expect(adminRoute).toContain("Open reports");
    expect(adminRoute).toContain("Pending verification");
    expect(adminRoute).toContain("Published store items");
    expect(adminRoute).toContain("Draft store items");
    expect(adminRoute).toContain("Flagged catalog");
    expect(adminRoute).toContain("Recent audit");
  });

  it("filters the moderation queue and submits persisted target actions", () => {
    expect(moderationRoute).toContain("statusFilter");
    expect(moderationRoute).toContain("targetFilter");
    expect(moderationRoute).toContain("categoryFilter");
    expect(moderationRoute).toContain("sortOrder");
    expect(moderationRoute).toContain("AdminActionMenu");
    expect(moderationRoute).toContain('fetch("/api/admin/moderation/action"');
    expect(moderationRoute).toContain("readCsrfToken()");
    expect(moderationRoute).toContain("revalidator.revalidate()");
    expect(moderationRoute).toContain("admin-desktop-table");
    expect(moderationRoute).toContain("admin-mobile-review-card");
  });

  it("separates verification context from the persisted decision workflow", () => {
    expect(verificationsRoute).toContain("admin-verification-card__context");
    expect(verificationsRoute).toContain("admin-verification-card__decision");
    expect(verificationsRoute).toContain("Open post");
    expect(verificationsRoute).toContain("Verify accepted source");
    expect(verificationsRoute).toContain("readCsrfToken()");
    expect(verificationsRoute).toContain("revalidator.revalidate()");
  });

  it("adds a searchable Users route with capability-gated role changes and no email fields", () => {
    expect(routes).toContain('route("admin/users", "routes/admin-users.tsx")');
    expect(usersRoute).toContain("createAdminReadService");
    expect(usersRoute).toContain(".users(query)");
    expect(usersRoute).toContain('"user.assign_roles"');
    expect(usersRoute).toContain("/api/admin/users/");
    expect(usersRoute).toContain("readCsrfToken()");
    expect(usersRoute).toContain('name="q"');
    expect(usersRoute.toLowerCase()).not.toContain("email");
  });

  it("adds a read-only Roles route with assignment counts and capability chips", () => {
    expect(routes).toContain('route("admin/roles", "routes/admin-roles.tsx")');
    expect(rolesRoute).toContain("createAdminReadService");
    expect(rolesRoute).toContain(".roles()");
    expect(rolesRoute).toContain("assignmentCount");
    expect(rolesRoute).toContain("capabilities");
    expect(rolesRoute).toContain("isSystem");
  });

  it("adds an audit.read-gated Audit route with fixed operational filters", () => {
    expect(routes).toContain('route("admin/audit", "routes/admin-audit.tsx")');
    expect(auditRoute).toContain('"audit.read"');
    expect(auditRoute).toContain("createAdminReadService");
    expect(auditRoute).toContain(".audit(");
    expect(auditRoute).toContain("targetType");
    expect(auditRoute).toContain('type="date"');
    expect(auditRoute).toContain("metadataJson");
  });
});