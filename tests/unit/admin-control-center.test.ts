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
const adminRoute = read("../../app/routes/admin.tsx");

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
});
