import { describe, expect, it, vi } from "vitest";
import { processReputationEvent } from "../../worker/reputation/service";

interface MockDbOptions {
  ruleAmount?: number;
  originalAmount?: number;
  achievements?: Array<{
    id: string;
    slug: string;
    version: number;
    name: string;
    description: string;
    icon: string;
    verified_source_threshold: number;
  }>;
}

function createDb(options: MockDbOptions = {}) {
  const statements: string[] = [];
  const bindings: Array<{ query: string; values: unknown[] }> = [];
  const db = {
    prepare: vi.fn((query: string) => {
      statements.push(query);
      let values: unknown[] = [];
      const statement = {
        bind: vi.fn((...nextValues: unknown[]) => {
          values = nextValues;
          bindings.push({ query, values: nextValues });
          return statement;
        }),
        first: vi.fn(async <T>() => {
          if (query.includes("FROM posts p")) {
            return { post_author_id: "post-author", comment_author_id: "contributor" } as T;
          }
          if (query.includes("FROM reputation_reward_rules")) {
            const rewardType =
              values[0] === "VERIFIED_SOURCE" ? "VERIFIED_SOURCE" : "ACCEPTED_SOURCE";
            return {
              id: `${rewardType.toLowerCase()}-v3`,
              reward_type: rewardType,
              version: 3,
              amount: options.ruleAmount ?? 37,
              provisional: rewardType === "ACCEPTED_SOURCE" ? 1 : 0,
            } as T;
          }
          if (
            query.includes("FROM point_ledger") &&
            query.includes("WHERE reward_type") &&
            query.includes("entry_type = 'AWARD'")
          ) {
            return {
              id: "original-ledger",
              user_id: "contributor",
              amount: options.originalAmount ?? 91,
              metadata_json: "{}",
            } as T;
          }
          if (query.includes("AS count") && query.includes("FROM point_ledger WHERE user_id")) {
            return { count: 1 } as T;
          }
          if (query.includes("COUNT(*) AS count")) return { count: 0 } as T;
          return null;
        }),
        all: vi.fn(async <T>() => ({
          results: query.includes("FROM achievement_catalog")
            ? ((options.achievements ?? []) as T[])
            : [],
          success: true as const,
          meta: {},
        })),
        run: vi.fn(async () => ({ success: true as const, results: [], meta: { changes: 1 } })),
      };
      return statement as unknown as D1PreparedStatement;
    }),
    batch: vi.fn(async (items: unknown[]) =>
      items.map(() => ({ success: true as const, results: [], meta: { changes: 1 } })),
    ),
  } as unknown as D1Database;
  return { db, statements, bindings };
}

function ledgerAmount(bindings: Array<{ query: string; values: unknown[] }>): number | undefined {
  return bindings.find((entry) => entry.query.includes("INSERT OR IGNORE INTO point_ledger"))
    ?.values[2] as number | undefined;
}

describe("versioned reputation rules", () => {
  it("uses the active D1 reward rule instead of hardcoded accepted-source points", async () => {
    const { db, statements, bindings } = createDb({ ruleAmount: 37 });

    await processReputationEvent(
      db,
      { type: "source.accepted", postId: "post", commentId: "comment" },
      100,
    );

    expect(statements.some((query) => query.includes("FROM reputation_reward_rules"))).toBe(true);
    expect(ledgerAmount(bindings)).toBe(37);
  });

  it("reverses the exact historical award amount even after reward rules change", async () => {
    const { db, bindings } = createDb({ originalAmount: 91, ruleAmount: 250 });

    await processReputationEvent(
      db,
      { type: "source.verification.revoked", postId: "post", commentId: "comment" },
      100,
    );

    expect(ledgerAmount(bindings)).toBe(-91);
  });

  it("loads active achievement definitions from D1 instead of a hardcoded catalog", async () => {
    const { db, statements } = createDb({
      ruleAmount: 125,
      achievements: [
        {
          id: "achievement-custom-v4",
          slug: "custom-source-milestone",
          version: 4,
          name: "Custom milestone",
          description: "Configured in Admin.",
          icon: "◆",
          verified_source_threshold: 1,
        },
      ],
    });
    const send = vi.fn(async () => undefined);

    await processReputationEvent(
      db,
      { type: "source.verified", postId: "post", commentId: "comment" },
      100,
      { send } as unknown as Queue,
    );

    expect(statements.some((query) => query.includes("FROM achievement_catalog"))).toBe(true);
    expect(send).toHaveBeenCalledWith({
      notification: expect.objectContaining({
        entityId: "achievement-custom-v4",
        payload: { slug: "custom-source-milestone", name: "Custom milestone" },
      }),
    });
  });
});
