import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { sourceBoardRequestContext } from "../../shared/router-context";
import type { SourceBoardEnvironment } from "../../worker/environment";
import { withOptionalServerSession } from "../../app/data/server-request";

function createContext(db?: D1Database) {
  const context = new RouterContextProvider();
  context.set(sourceBoardRequestContext, {
    env: { DB: db } as SourceBoardEnvironment,
    requestId: "runtime-test",
    cspNonce: "runtime-test",
  });
  return context;
}

describe("server request runtime availability", () => {
  it("reports unavailable when the D1 binding is missing", async () => {
    const loaded = vi.fn(async () => ({ unavailable: false }));
    const result = await withOptionalServerSession(
      new Request("https://srcboard.me/"),
      createContext(),
      (unavailable) => ({ unavailable }),
      loaded,
    );

    expect(result).toEqual({ unavailable: true });
    expect(loaded).not.toHaveBeenCalled();
  });

  it("does not disguise D1 or service failures as a missing runtime", async () => {
    const failure = new Error("D1_ERROR: no such column: p.category_slug");

    await expect(
      withOptionalServerSession(
        new Request("https://srcboard.me/"),
        createContext({} as D1Database),
        (unavailable) => ({ unavailable }),
        async () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);
  });
});
