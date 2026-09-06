import { describe, expect, it, vi } from "vitest";
import { createSystemMetadataRepository } from "../../worker/db/repository";

function createPreparedStatementMock(row: unknown = null) {
  const statement = {
    bind: vi.fn(() => statement),
    first: vi.fn(async () => row),
    run: vi.fn(async () => ({
      success: true,
      results: [],
      meta: {},
    })),
  };

  return statement;
}

describe("system metadata D1 repository", () => {
  it("reads through a prepared query and maps SQLite columns", async () => {
    const statement = createPreparedStatementMock({
      key: "phase",
      value: "1",
      created_at: 100,
      updated_at: 200,
    });
    const db = {
      prepare: vi.fn(() => statement),
    } as unknown as D1Database;

    const result = await createSystemMetadataRepository(db).get("phase");

    expect(result).toEqual({
      key: "phase",
      value: "1",
      createdAt: 100,
      updatedAt: 200,
    });
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("WHERE key = ?"));
    expect(statement.bind).toHaveBeenCalledWith("phase");
  });

  it("upserts through bound values without interpolating input", async () => {
    const statement = createPreparedStatementMock();
    const db = {
      prepare: vi.fn(() => statement),
    } as unknown as D1Database;
    const key = "secret-key'; DROP TABLE system_metadata; --";

    await createSystemMetadataRepository(db).set(key, "value", 123);

    const query = vi.mocked(db.prepare).mock.calls[0]?.[0] ?? "";
    expect(query).not.toContain(key);
    expect(query).toContain("ON CONFLICT (key)");
    expect(statement.bind).toHaveBeenCalledWith(key, "value", 123, 123);
    expect(statement.run).toHaveBeenCalledOnce();
  });

  it("returns null for a missing metadata row", async () => {
    const statement = createPreparedStatementMock(null);
    const db = {
      prepare: vi.fn(() => statement),
    } as unknown as D1Database;

    await expect(createSystemMetadataRepository(db).get("missing")).resolves.toBeNull();
  });
});
