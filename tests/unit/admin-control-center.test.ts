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
});
