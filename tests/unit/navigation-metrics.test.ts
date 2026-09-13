import { describe, expect, it } from "vitest";

import {
  classifyNavigationPath,
  markNavigationReady,
  markNavigationStart,
} from "../../app/data/performance-metrics";

describe("navigation metrics", () => {
  it("normalizes destinations to route families without retaining identifiers", () => {
    expect(classifyNavigationPath("/posts/private-post/source")).toBe("post");
    expect(classifyNavigationPath("/u/aurora-vale")).toBe("profile");
    expect(classifyNavigationPath("/es/store")).toBe("store");
    expect(classifyNavigationPath("/de/posts/private-post/source")).toBe("post");
    expect(classifyNavigationPath("/fr/u/aurora-vale")).toBe("profile");
    expect(markNavigationStart("/posts/private-post?from=feed")).toBe("post");
    expect(markNavigationReady("/posts/private-post")).toBe("post");
  });
});
