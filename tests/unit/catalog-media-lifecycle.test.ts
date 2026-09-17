import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { deleteCatalogAssetBestEffort, updateEmoteMediaReference } from "../../worker/catalog/api";

function createD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: result.changes } } as D1Result<unknown>;
      },
    };
    return statement;
  }
  return { prepare } as unknown as D1Database;
}

describe("catalog media lifecycle", () => {
  it("does not overwrite a newer emote image reference", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE emote_catalog (id TEXT PRIMARY KEY, asset_key TEXT NOT NULL);
        INSERT INTO emote_catalog VALUES ('emote-1', 'catalog/emote/old');
      `);

      sqlite
        .prepare("UPDATE emote_catalog SET asset_key = 'catalog/emote/newer' WHERE id = 'emote-1'")
        .run();

      await expect(
        updateEmoteMediaReference(createD1(sqlite), {
          id: "emote-1",
          currentAssetKey: "catalog/emote/old",
          newAssetKey: "catalog/emote/stale",
          now: 3,
        }),
      ).resolves.toBe(false);
      expect(
        sqlite.prepare("SELECT asset_key FROM emote_catalog WHERE id = 'emote-1'").get(),
      ).toEqual({ asset_key: "catalog/emote/newer" });
    } finally {
      sqlite.close();
    }
  });

  it("keeps cleanup failure observable without masking the operation result", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const media = {
      delete: vi.fn(async () => {
        throw new Error("R2 unavailable");
      }),
    } as unknown as R2Bucket;

    await expect(
      deleteCatalogAssetBestEffort(media, "catalog/emote/new", "catalog_media_compensation"),
    ).resolves.toBeUndefined();
    expect(media.delete).toHaveBeenCalledWith("catalog/emote/new");
    expect(errorSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "background_failure", component: "catalog_media_compensation" }),
    );

    errorSpy.mockRestore();
  });
});
