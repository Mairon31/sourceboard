from pathlib import Path

path = Path("worker/search/service.ts")
source = path.read_text()

if "function isMissingPostCategoryColumn" in source:
    raise SystemExit(0)

marker = "function postSearchQuery(\n"
insertion = '''function isMissingPostCategoryColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column[^\\n]*category_slug/i.test(message);
}

function postSearchQuery(
'''
assert marker in source
source = source.replace(marker, insertion, 1)

old = '''  limit: number,
  hideNsfw: boolean,
): { sql: string; bindings: unknown[] } {'''
new = '''  limit: number,
  hideNsfw: boolean,
  legacyCategory = false,
): { sql: string; bindings: unknown[] } {'''
assert old in source
source = source.replace(old, new, 1)

old = '''  if (categorySlug) {
    conditions.push("p.category_slug = ?");
    bindings.push(categorySlug);
  }'''
new = '''  if (categorySlug && !legacyCategory) {
    conditions.push("p.category_slug = ?");
    bindings.push(categorySlug);
  }'''
assert old in source
source = source.replace(old, new, 1)

old = '''      p.description,
      p.category_slug,
      p.visibility,'''
new = '''      p.description,
      ${legacyCategory ? "'other' AS category_slug" : "p.category_slug"},
      p.visibility,'''
assert old in source
source = source.replace(old, new, 1)

old = '''      const postPromise =
        input.kind === "profiles"
          ? Promise.resolve({ results: [] as PostSearchRow[] })
          : dependencies.db
              .prepare(postQuery.sql)
              .bind(...postQuery.bindings)
              .all<PostSearchRow>();'''
new = '''      const postPromise =
        input.kind === "profiles"
          ? Promise.resolve({ results: [] as PostSearchRow[] })
          : (async () => {
              try {
                return await dependencies.db
                  .prepare(postQuery.sql)
                  .bind(...postQuery.bindings)
                  .all<PostSearchRow>();
              } catch (error) {
                if (!isMissingPostCategoryColumn(error)) throw error;
                if (input.categorySlug && input.categorySlug !== "other") {
                  return { results: [] as PostSearchRow[] };
                }
                const legacyPostQuery = postSearchQuery(
                  fts,
                  input.viewerId,
                  input.kind,
                  input.filter,
                  null,
                  postCursor,
                  limit,
                  hideNsfw,
                  true,
                );
                return dependencies.db
                  .prepare(legacyPostQuery.sql)
                  .bind(...legacyPostQuery.bindings)
                  .all<PostSearchRow>();
              }
            })();'''
assert old in source
source = source.replace(old, new, 1)

path.write_text(source)
