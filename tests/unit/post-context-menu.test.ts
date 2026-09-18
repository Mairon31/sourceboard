import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("post contextual moderation contract", () => {
  it("keeps contextual actions on summary cards across post collections", () => {
    const contracts = read("shared/ui/contracts.ts");
    const service = read("worker/posts/service.ts");
    const search = read("worker/search/service.ts");
    const card = read("app/components/product/PostCard.tsx");
    const overlays = read("app/components/ui/overlays.tsx");

    expect(contracts).toContain("permissions?: Partial<PostPermissionView>");
    expect(service).toContain("canReport: Boolean(viewerId)");
    expect(search).toContain("Boolean(input.viewerId && input.viewerId !== row.author_id)");
    expect(card).toContain("canOpenPostModeration(permissions)");
    expect(read("app/components/product/SearchPostGrid.tsx")).toContain("PostModerationMenu");
    expect(read("app/components/product/SearchPostGallery.tsx")).toContain("PostModerationMenu");
    expect(card).toContain("permissions?.canReport");
    expect(overlays).toContain("event.stopPropagation()");
  });

  it("keeps the moderation entry point contextual while the admin queue remains guarded", () => {
    const access = read("app/data/admin-access.ts");
    const route = read("app/routes/admin-moderation.tsx");
    const card = read("app/components/product/PostCard.tsx");

    expect(access).toContain("requireModerationPageAccess");
    expect(route).toContain("requireModerationPageAccess(request, context)");
    expect(route).toContain('searchParams.get("targetId")');
    expect(route).toContain('useState(focusTarget?.targetId ?? "")');
    expect(card).toContain("setModerationOpen(true)");
    expect(card).not.toContain("/admin/moderation?target=POST&targetId=");
  });

  it("decorates every PostCard-backed collection with the viewer actions", () => {
    for (const route of [
      "app/routes/_index.tsx",
      "app/routes/feed-resource.tsx",
      "app/routes/category.tsx",
      "app/routes/profile.tsx",
      "app/routes/my-profile.tsx",
      "app/routes/search.tsx",
    ]) {
      expect(read(route), route).toContain("withPostActionPermissions");
    }
  });
});
