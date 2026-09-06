import { describe, expect, it } from "vitest";
import {
  assertCanChangeRole,
  hasCapability,
  type AuthorizationSnapshot,
} from "../../worker/auth/rbac";

function authorization(
  roles: AuthorizationSnapshot["roles"],
  capabilities: string[],
): AuthorizationSnapshot {
  return { roles, capabilities: new Set(capabilities) };
}

describe("capability-based authorization", () => {
  it("checks capabilities independently from role names", () => {
    const moderator = authorization([{ slug: "moderator", rank: 60 }], ["post.moderate"]);
    expect(hasCapability(moderator, "post.moderate")).toBe(true);
    expect(hasCapability(moderator, "user.assign_roles")).toBe(false);
  });

  it("allows an authorized admin to manage lower-ranked roles", () => {
    const admin = authorization([{ slug: "admin", rank: 80 }], ["user.assign_roles"]);
    const user = authorization([{ slug: "user", rank: 10 }], []);

    expect(() => assertCanChangeRole(admin, user, "moderator", "assign")).not.toThrow();
  });

  it("protects owner targets and owner assignment from lower roles", () => {
    const admin = authorization([{ slug: "admin", rank: 80 }], ["user.assign_roles"]);
    const owner = authorization([{ slug: "owner", rank: 100 }], []);

    expect(() => assertCanChangeRole(admin, owner, "admin", "remove")).toThrowError(/owner role/);
    expect(() =>
      assertCanChangeRole(
        admin,
        authorization([{ slug: "user", rank: 10 }], []),
        "owner",
        "assign",
      ),
    ).toThrowError(/owner role/);
  });

  it("does not permit removing the owner role through the role endpoint", () => {
    const owner = authorization([{ slug: "owner", rank: 100 }], ["user.assign_roles"]);
    expect(() => assertCanChangeRole(owner, owner, "owner", "remove")).toThrowError(
      /cannot be removed/,
    );
  });
});
