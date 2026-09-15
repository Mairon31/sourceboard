import { describe, expect, it, vi } from "vitest";
import { createModerationService } from "../../worker/moderation/service";

describe("moderation queue context contract", () => {
  it("loads report context in one bounded query without a per-row fetch loop", async () => {
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({
          results: [
            {
              id: "report-1",
              reporterUserId: "reporter-1",
              reporterUsername: "reporter",
              reportedUserId: "author-1",
              reportedUsername: "author",
              targetType: "COMMENT",
              targetId: "comment-1",
              category: "SPAM",
              detail: "Repeated links",
              status: "OPEN",
              assigneeUserId: null,
              createdAt: 100,
              updatedAt: 100,
              postId: "post-1",
              postSlug: "source-request",
              postTitle: "Find this source",
              commentBody: "This is the reported comment.",
              commentId: "comment-1",
              moderationHistoryJson: "[]",
            },
          ],
        })),
      };
      return statement;
    });
    const db = { prepare } as unknown as D1Database;

    const reports = await createModerationService(db).listQueue(10);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(String(prepare.mock.calls[0]?.[0])).toContain("JOIN users reporter");
    expect(reports[0]).toMatchObject({
      reporterUsername: "reporter",
      reportedUsername: "author",
      resourceUrl: "/posts/post-1/source-request#comment-comment-1",
      postTitle: "Find this source",
      commentBody: "This is the reported comment.",
      moderationHistory: [],
    });
  });
});
