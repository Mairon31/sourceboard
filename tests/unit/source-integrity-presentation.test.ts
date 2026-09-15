import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../../app/routes/admin-verifications.tsx", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../../app/components/admin/admin.css", import.meta.url), "utf8");

describe("source integrity admin presentation contract", () => {
  it("provides search and persisted-state filters without inventing resolution states", () => {
    expect(route).toContain("source.integrity.search");
    expect(route).toContain("source.integrity.searchPlaceholder");
    expect(route).toContain("const [search, setSearch] = useState(\"\")");
    expect(route).toContain("const [statusFilter, setStatusFilter] = useState(\"ALL\")");
    expect(route).toContain("const visibleEntries = useMemo");
    expect(route).toContain("entry.state");
    expect(route).toContain("entry.resolutionType");
    expect(route).not.toContain("\"PENDING\"");
    expect(route).not.toContain("\"REJECTED\"");
  });

  it("keeps canonical post/source links and actor context visible", () => {
    expect(route).toContain("postHref(");
    expect(route).toContain("canonicalSourceUrl");
    expect(route).toContain("actorLabel");
    expect(route).toContain("revokedByLabel");
    expect(route).toContain("source.verify");
  });

  it("uses a responsive results hierarchy and compact action layout", () => {
    expect(route).toContain("admin-integrity-results");
    expect(route).toContain("admin-integrity-actions");
    expect(adminCss).toContain(".admin-integrity-results");
    expect(adminCss).toContain(".admin-integrity-actions");
    expect(adminCss).toContain("@media (max-width: 720px)");
  });
});
