from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrence(s), found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


frontend = "app/components/admin/store/AdminEmotePackManager.tsx"
replace_exact(
    frontend,
    'pattern="[a-z0-9][a-z0-9_-]{1,63}"',
    'pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"',
    expected=2,
)
replace_exact(
    frontend,
    'pattern="[a-z0-9][a-z0-9-]{1,63}"',
    'pattern="[a-z0-9](?:[a-z0-9]|-){1,63}"',
    expected=2,
)

api = "worker/catalog/api.ts"
replace_exact(
    api,
    '''  return (\n    message.includes("no such column") &&\n    ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some(\n      (column) => message.includes(column),\n    )\n  );''',
    '''  const missingColumn =\n    message.includes("no such column") || message.includes("has no column named");\n  return (\n    missingColumn &&\n    ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some(\n      (column) => message.includes(column),\n    )\n  );''',
)

legacy_helper = '''\nasync function legacyCreateEmote(\n  db: D1Database,\n  input: {\n    id: string;\n    shortcode: string;\n    label: string;\n    assetKey: string;\n    packId: string | null;\n    now: number;\n  },\n): Promise<void> {\n  await db\n    .prepare(\n      `INSERT INTO emote_catalog (id, shortcode, label, asset_key, pack_id, status, sort_order, created_at)\n       VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`,\n    )\n    .bind(\n      input.id,\n      input.shortcode,\n      input.label,\n      input.assetKey,\n      input.packId,\n      input.now,\n    )\n    .run();\n}\n'''
replace_exact(api, "\nasync function legacyListEmotePacks(\n", legacy_helper + "\nasync function legacyListEmotePacks(\n")

old_insert = '''    if (kind === "emote") {\n      await env.DB.prepare(\n        `INSERT INTO emote_catalog\n         (id, shortcode, label, asset_key, pack_id, status, sort_order, lifecycle_state,\n          is_enabled, moderation_state, created_at, updated_at)\n         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)`,\n      )\n        .bind(id, key, label, assetKey, packId, now, now)\n        .run();\n    } else {'''
new_insert = '''    if (kind === "emote") {\n      try {\n        await env.DB.prepare(\n          `INSERT INTO emote_catalog\n           (id, shortcode, label, asset_key, pack_id, status, sort_order, lifecycle_state,\n            is_enabled, moderation_state, created_at, updated_at)\n           VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)`,\n        )\n          .bind(id, key, label, assetKey, packId, now, now)\n          .run();\n      } catch (error) {\n        if (!isCatalogLifecycleSchemaError(error)) throw error;\n        await legacyCreateEmote(env.DB, {\n          id,\n          shortcode: key,\n          label,\n          assetKey,\n          packId,\n          now,\n        });\n      }\n    } else {'''
replace_exact(api, old_insert, new_insert)

# Strengthen the regression contract for the INSERT-specific SQLite error form and sibling slug patterns.
test_path = "tests/unit/store-schema-compatibility.test.ts"
replace_exact(
    test_path,
    '    expect(catalogApi).toContain("isCatalogLifecycleSchemaError(error)");\n  });',
    '    expect(catalogApi).toContain("isCatalogLifecycleSchemaError(error)");\n    expect(catalogApi).toContain("has no column named");\n  });',
)
replace_exact(
    test_path,
    '''    expect(adminEmotePacks).not.toContain('pattern="[a-z0-9][a-z0-9_-]{1,63}"');\n    expect(adminEmotePacks).toContain('pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"');''',
    '''    expect(adminEmotePacks).not.toContain('pattern="[a-z0-9][a-z0-9_-]{1,63}"');\n    expect(adminEmotePacks).toContain('pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"');\n    expect(adminEmotePacks).not.toContain('pattern="[a-z0-9][a-z0-9-]{1,63}"');\n    expect(adminEmotePacks).toContain('pattern="[a-z0-9](?:[a-z0-9]|-){1,63}"');''',
)
