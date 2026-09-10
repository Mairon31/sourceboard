import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createD1UsernamePolicyStore,
  createUsernamePolicyService,
  evaluateUsernameChangePolicy,
  type UsernameChangeRecord,
  type UsernamePolicyStore,
} from "../../worker/profile/username-policy";
import { isAdminAuditAction } from "../../worker/admin/audit-visibility";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 2_000_000_000_000;

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

function fakeStore(options?: {
  changes?: UsernameChangeRecord[];
  usernameOwnerId?: string | null;
}): UsernamePolicyStore {
  return {
    getIdentity: vi.fn(async () => ({
      id: "user-1",
      username: "Mairon",
      usernameNormalized: "mairon",
    })),
    findByUsernameNormalized: vi.fn(async () =>
      options?.usernameOwnerId
        ? { id: options.usernameOwnerId, username: "Taken", usernameNormalized: "taken" }
        : null,
    ),
    listChangesSince: vi.fn(async () => options?.changes ?? []),
    commitChange: vi.fn(async () => undefined),
  };
}

describe("community plan phase E1", () => {
  it("enforces a 24 hour cooldown between username changes", () => {
    const status = evaluateUsernameChangePolicy([NOW - 23 * HOUR], NOW);
    expect(status.canChange).toBe(false);
    expect(status.remainingChanges).toBe(2);
    expect(status.nextChangeAt).toBe(NOW + HOUR);
  });

  it("enforces max 3 username changes in a sliding 15 day window", () => {
    const blocked = evaluateUsernameChangePolicy(
      [NOW - 14 * DAY, NOW - 5 * DAY, NOW - 2 * DAY],
      NOW,
    );
    expect(blocked.canChange).toBe(false);
    expect(blocked.remainingChanges).toBe(0);
    expect(blocked.nextChangeAt).toBe(NOW + DAY);

    const sliding = evaluateUsernameChangePolicy(
      [NOW - 16 * DAY, NOW - 5 * DAY, NOW - 2 * DAY],
      NOW,
    );
    expect(sliding.canChange).toBe(true);
    expect(sliding.remainingChanges).toBe(1);
    expect(sliding.nextChangeAt).toBeNull();
  });

  it("validates username uniqueness and persists the normalized change with audit context", async () => {
    const taken = fakeStore({ usernameOwnerId: "user-2" });
    const takenService = createUsernamePolicyService({ store: taken, now: () => NOW });
    await expect(
      takenService.changeUsername("user-1", "Taken", {
        requestId: "request-1",
        ipPrefixHash: "ip",
      }),
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });

    const available = fakeStore();
    const service = createUsernamePolicyService({
      store: available,
      now: () => NOW,
      createId: () => "generated-id",
    });
    const result = await service.changeUsername("user-1", "New_User", {
      requestId: "request-2",
      ipPrefixHash: "ip-2",
    });
    expect(result.username).toBe("New_User");
    expect(available.commitChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        userId: "user-1",
        oldUsername: "Mairon",
        newUsername: "New_User",
        newUsernameNormalized: "new_user",
        changedAt: NOW,
        audit: expect.objectContaining({ requestId: "request-2", ipPrefixHash: "ip-2" }),
      }),
    );
  });

  it("rejects invalid usernames without consuming history", async () => {
    const store = fakeStore();
    const service = createUsernamePolicyService({ store, now: () => NOW });
    await expect(
      service.changeUsername("user-1", "not valid!", { requestId: "request", ipPrefixHash: "ip" }),
    ).rejects.toMatchObject({ code: "INVALID_USERNAME" });
    expect(store.commitChange).not.toHaveBeenCalled();
  });

  it("enforces username quota again at the D1 commit boundary", async () => {
    const migration = read("../../migrations/0026_username_change_history.sql");
    expect(migration).toContain("CREATE TRIGGER username_change_history_guard");

    const input = {
      id: "change-1",
      userId: "user-1",
      oldUsername: "Mairon",
      newUsername: "New_User",
      newUsernameNormalized: "new_user",
      changedAt: NOW,
      audit: { id: "audit-1", requestId: "request-1", ipPrefixHash: "ip-1" },
    };

    for (const [constraint, code] of [
      ["USERNAME_CHANGE_COOLDOWN", "USERNAME_CHANGE_COOLDOWN"],
      ["USERNAME_CHANGE_LIMIT", "USERNAME_CHANGE_LIMIT"],
    ] as const) {
      const statement = { bind: vi.fn(() => statement) };
      const db = {
        prepare: vi.fn(() => statement),
        batch: vi.fn(async () => {
          throw new Error(`D1_ERROR: ${constraint}`);
        }),
      } as unknown as D1Database;
      await expect(createD1UsernamePolicyStore(db).commitChange(input)).rejects.toMatchObject({
        status: 429,
        code,
      });
    }
  });

  it("adds forward-only username history, account API and Settings quota UI", () => {
    const migration = read("../../migrations/0026_username_change_history.sql");
    const api = read("../../worker/profile/api-core.ts");
    const settings = read("../../app/routes/settings.tsx");
    expect(migration).toContain("CREATE TABLE username_change_history");
    expect(migration).toContain("user_id, changed_at");
    expect(api).toContain('"GET /api/profile/me/username"');
    expect(api).toContain('"PATCH /api/profile/me/username"');
    expect(settings).toContain("/api/profile/me/username");
    expect(settings).toContain("changes available");
  });

  it("shows privileged audit activity by default and excludes ordinary account/user activity", () => {
    for (const action of [
      "admin.user_note",
      "moderation.sanction_revoked",
      "rbac.role_assign",
      "STORE_ITEM_CREATED",
      "STORE_ITEM_PUBLISH",
      "source.verified",
      "source.verification.revoked",
      "post.nsfw.mark",
    ]) {
      expect(isAdminAuditAction(action), action).toBe(true);
    }
    for (const action of [
      "auth.login",
      "auth.logout",
      "auth.password_changed",
      "user.username_changed",
      "store.purchased",
      "friend.request",
      "source.accepted",
      "COSMETIC_SUBMISSION_CREATED",
    ]) {
      expect(isAdminAuditAction(action), action).toBe(false);
    }
    expect(read("../../worker/admin/read.ts")).toContain("ADMIN_AUDIT_SQL_PREDICATE");
  });
});
