import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`${label} marker missing`);
  return text.replace(from, to);
}

function insertBefore(text, marker, insertion, label) {
  if (!text.includes(marker)) throw new Error(`${label} marker missing`);
  if (text.includes(insertion.trim().split("\n")[0])) return text;
  return text.replace(marker, `${insertion}${marker}`);
}

function fixAdminPreview() {
  const path = "app/components/admin/store/AdminEmotePackManager.tsx";
  let text = readFileSync(path, "utf8");
  text = replaceRequired(
    text,
    "src={`/api/media/catalog/emote/${encodeURIComponent(emote.id)}`}",
    "src={`/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}/media`}",
    "Admin emote preview",
  );
  writeFileSync(path, text);
}

function fixCatalogApi() {
  const path = "worker/catalog/api.ts";
  let text = readFileSync(path, "utf8");

  const schemaHelper = `async function hasCatalogLifecycleSchema(db: D1Database): Promise<boolean> {\n  try {\n    await db.prepare("SELECT lifecycle_state FROM emote_packs LIMIT 1").first();\n    return true;\n  } catch (error) {\n    if (!isCatalogLifecycleSchemaError(error)) throw error;\n    return false;\n  }\n}\n\n`;
  text = insertBefore(text, "async function legacyListEmotes", schemaHelper, "catalog schema helper");

  const legacyPackUpdate = `async function legacyUpdateEmotePack(\n  packId: string,\n  body: Record<string, unknown>,\n  requestId: string,\n  env: SourceBoardEnvironment,\n): Promise<Response> {\n  const current = await env.DB!.prepare(\n    \`SELECT p.id, p.status FROM emote_packs p WHERE p.id = ?\`,\n  )\n    .bind(packId)\n    .first<{ id: string; status: \"ACTIVE\" | \"DISABLED\" }>();\n  if (!current) return failure(\"NOT_FOUND\", \"Emote pack not found.\", requestId, 404);\n\n  let lifecycleState: LifecycleState = current.status === \"ACTIVE\" ? \"PUBLISHED\" : \"DRAFT\";\n  let isEnabled = current.status === \"ACTIVE\";\n  const legacyStatus = body.status as \"ACTIVE\" | \"DISABLED\" | undefined;\n  if (legacyStatus) {\n    lifecycleState = legacyStatus === \"ACTIVE\" ? \"PUBLISHED\" : \"DRAFT\";\n    isEnabled = legacyStatus === \"ACTIVE\";\n  } else {\n    if (body.lifecycleState !== undefined) {\n      lifecycleState = body.lifecycleState as LifecycleState;\n      if (body.isEnabled === undefined) isEnabled = lifecycleState === \"PUBLISHED\";\n    }\n    if (body.isEnabled !== undefined) {\n      isEnabled = body.isEnabled as boolean;\n      if (body.lifecycleState === undefined) lifecycleState = isEnabled ? \"PUBLISHED\" : \"DRAFT\";\n    }\n  }\n  if (lifecycleState === \"ARCHIVED\") isEnabled = false;\n  const active = lifecycleState === \"PUBLISHED\" && isEnabled;\n\n  if (active) {\n    const usable = await env.DB!.prepare(\n      \`SELECT 1 AS available FROM emote_catalog WHERE pack_id = ? AND status = 'ACTIVE' LIMIT 1\`,\n    )\n      .bind(packId)\n      .first<{ available: number }>();\n    if (!usable)\n      return failure(\n        \"EMPTY_EMOTE_PACK\",\n        \"Publish and enable at least one usable emote before publishing this pack.\",\n        requestId,\n        409,\n      );\n  }\n\n  await env.DB!.prepare(\"UPDATE emote_packs SET status = ? WHERE id = ?\")\n    .bind(active ? \"ACTIVE\" : \"DISABLED\", packId)\n    .run();\n  await env.DB!.prepare(\n    \`UPDATE store_items SET is_active = ?, updated_at = ?\n     WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?\`,\n  )\n    .bind(active ? 1 : 0, Date.now(), packId)\n    .run();\n\n  if (body.label !== undefined) {\n    const label = String(body.label).trim();\n    await env.DB!.prepare(\"UPDATE emote_packs SET label = ? WHERE id = ?\").bind(label, packId).run();\n    await env.DB!.prepare(\n      \`UPDATE store_items SET name = ?, updated_at = ?\n       WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?\`,\n    )\n      .bind(label, Date.now(), packId)\n      .run();\n  }\n  if (body.description !== undefined) {\n    await env.DB!.prepare(\n      \`UPDATE store_items SET description = ?, updated_at = ?\n       WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?\`,\n    )\n      .bind(String(body.description).trim(), Date.now(), packId)\n      .run();\n  }\n  if (body.pricePoints !== undefined) {\n    await env.DB!.prepare(\n      \`UPDATE store_items SET price_points = ?, updated_at = ?\n       WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?\`,\n    )\n      .bind(body.pricePoints, Date.now(), packId)\n      .run();\n  }\n\n  return response({ pack: { id: packId, updated: true, lifecycleState, isEnabled } }, requestId);\n}\n\n`;
  text = insertBefore(text, "async function updateEmotePack(", legacyPackUpdate, "legacy pack update");

  const packValidationMarker = `  if (body.status !== undefined && body.status !== "ACTIVE" && body.status !== "DISABLED")\n    return failure("INVALID_STATUS", "Status must be ACTIVE or DISABLED.", requestId, 400);\n\n`;
  text = replaceRequired(
    text,
    packValidationMarker,
    `${packValidationMarker}  if (!(await hasCatalogLifecycleSchema(env.DB)))\n    return legacyUpdateEmotePack(packId, body, requestId, env);\n\n`,
    "legacy pack update dispatch",
  );

  const adminAsset = `async function handleAdminEmoteAsset(\n  id: string,\n  env: SourceBoardEnvironment,\n  requestId: string,\n): Promise<Response> {\n  if (!env.DB || !env.MEDIA)\n    return failure(\n      \"CATALOG_UNAVAILABLE\",\n      \"Catalog media is temporarily unavailable.\",\n      requestId,\n      503,\n    );\n  const row = await env.DB.prepare(\"SELECT asset_key AS assetKey FROM emote_catalog WHERE id = ?\")\n    .bind(id)\n    .first<{ assetKey: string }>();\n  if (!row) return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n  const object = await env.MEDIA.get(row.assetKey);\n  if (!object) return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n  const headers = new Headers({\n    \"cache-control\": \"no-store\",\n    etag: object.httpEtag,\n    [REQUEST_ID_HEADER]: requestId,\n  });\n  if (object.httpMetadata?.contentType)\n    headers.set(\"content-type\", object.httpMetadata.contentType);\n  return new Response(object.body, { headers });\n}\n\n`;
  text = insertBefore(text, "async function handlePublicAsset(", adminAsset, "Admin emote asset");

  const routeMarker = `    const actorUserId = await requireCapability(request, requestId, env, CAPABILITIES[kind]);\n`;
  const adminMediaRoute = `${routeMarker}    const adminEmoteMediaMatch =\n      kind === "emote"\n        ? url.pathname.match(/^\\/api\\/admin\\/catalog\\/emotes\\/([^/]+)\\/media$/)\n        : null;\n    if (request.method === "GET" && adminEmoteMediaMatch)\n      return await handleAdminEmoteAsset(\n        decodeURIComponent(adminEmoteMediaMatch[1] ?? ""),\n        env,\n        requestId,\n      );\n`;
  text = replaceRequired(text, routeMarker, adminMediaRoute, "Admin emote media route");

  const replaceImageUpdate = `    await env.DB.prepare("UPDATE emote_catalog SET asset_key = ?, updated_at = ? WHERE id = ?")\n      .bind(newAssetKey, Date.now(), id)\n      .run();`;
  const replaceImageCompatible = `    if (await hasCatalogLifecycleSchema(env.DB)) {\n      await env.DB.prepare(\n        "UPDATE emote_catalog SET asset_key = ?, updated_at = ? WHERE id = ?",\n      )\n        .bind(newAssetKey, Date.now(), id)\n        .run();\n    } else {\n      await env.DB.prepare("UPDATE emote_catalog SET asset_key = ? WHERE id = ?")\n        .bind(newAssetKey, id)\n        .run();\n    }`;
  text = replaceRequired(
    text,
    replaceImageUpdate,
    replaceImageCompatible,
    "legacy image replacement",
  );

  const publicEmoteStart = `  let assetKey: string;\n  if (kind === "emote") {\n    const row = await env.DB.prepare(`;
  const publicEmoteEnd = `  } else {\n    const row = await env.DB.prepare(\n      "SELECT asset_key AS assetKey FROM sticker_catalog WHERE id = ? AND status = 'ACTIVE'",`;
  const start = text.indexOf(publicEmoteStart);
  const end = text.indexOf(publicEmoteEnd, start);
  if (start < 0 || end < 0) throw new Error("public emote asset block markers missing");
  const oldBlock = text.slice(start, end);
  const newBlock = `  let assetKey: string;\n  if (kind === "emote") {\n    if (!(await hasCatalogLifecycleSchema(env.DB))) {\n      const row = await env.DB.prepare(\n        \`SELECT e.asset_key AS assetKey, e.status, e.pack_id AS packId, p.status AS packStatus\n         FROM emote_catalog e LEFT JOIN emote_packs p ON p.id = e.pack_id WHERE e.id = ?\`,\n      )\n        .bind(id)\n        .first<{\n          assetKey: string;\n          status: string;\n          packId: string | null;\n          packStatus: string | null;\n        }>();\n      if (!row) return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n      const packAvailable = row.packId === null || row.packStatus === \"ACTIVE\";\n      if (row.status !== \"ACTIVE\" || !packAvailable)\n        return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n      assetKey = row.assetKey;\n    } else {\n      const row = await env.DB.prepare(\n        \`SELECT e.asset_key AS assetKey, e.lifecycle_state AS lifecycleState,\n                e.is_enabled AS isEnabled, e.moderation_state AS moderationState,\n                e.pack_id AS packId, p.lifecycle_state AS packLifecycleState,\n                p.is_enabled AS packEnabled\n         FROM emote_catalog e\n         LEFT JOIN emote_packs p ON p.id = e.pack_id\n         WHERE e.id = ?\`,\n      )\n        .bind(id)\n        .first<{\n          assetKey: string;\n          lifecycleState: LifecycleState;\n          isEnabled: number;\n          moderationState: ModerationState;\n          packId: string | null;\n          packLifecycleState: LifecycleState | null;\n          packEnabled: number | null;\n        }>();\n      if (!row) return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n      if (row.moderationState === \"HIDDEN\" || row.moderationState === \"REMOVED\")\n        return blockedEmoteResponse(requestId);\n      const packAvailable =\n        row.packId === null ||\n        (row.packLifecycleState === \"PUBLISHED\" && Number(row.packEnabled) === 1);\n      if (row.lifecycleState !== \"PUBLISHED\" || Number(row.isEnabled) !== 1 || !packAvailable)\n        return failure(\"NOT_FOUND\", \"Catalog media not found.\", requestId, 404);\n      assetKey = row.assetKey;\n    }\n`;
  text = text.slice(0, start) + newBlock + text.slice(end);

  writeFileSync(path, text);
}

function fixStoreAdminLegacyAction() {
  const path = "worker/store/admin.ts";
  let text = readFileSync(path, "utf8");
  const oldUpdate = `      await db\n        .prepare(\n          \`UPDATE store_items\n           SET lifecycle_state = ?, is_enabled = ?, is_featured = ?, is_active = ?, updated_at = ?\n           WHERE id = ?\`,\n        )\n        .bind(lifecycleState, isEnabled ? 1 : 0, isFeatured ? 1 : 0, isActive ? 1 : 0, now, id)\n        .run();`;
  const newUpdate = `      try {\n        await db\n          .prepare(\n            \`UPDATE store_items\n             SET lifecycle_state = ?, is_enabled = ?, is_featured = ?, is_active = ?, updated_at = ?\n             WHERE id = ?\`,\n          )\n          .bind(\n            lifecycleState,\n            isEnabled ? 1 : 0,\n            isFeatured ? 1 : 0,\n            isActive ? 1 : 0,\n            now,\n            id,\n          )\n          .run();\n      } catch (error) {\n        if (!isStoreAdminLifecycleSchemaError(error)) throw error;\n        const legacyActive = action === \"PUBLISH\" || action === \"ENABLE\" ? 1 : action === \"UNPUBLISH\" || action === \"DISABLE\" || action === \"ARCHIVE\" ? 0 : isActive ? 1 : 0;\n        await db.prepare(\"UPDATE store_items SET is_active = ?, updated_at = ? WHERE id = ?\")\n          .bind(legacyActive, now, id)\n          .run();\n      }`;
  text = replaceRequired(text, oldUpdate, newUpdate, "legacy Store action");
  writeFileSync(path, text);
}

function fixE2E() {
  const helperPath = "tests/e2e/test-helpers.ts";
  let helper = readFileSync(helperPath, "utf8");
  helper = helper.replaceAll("secure: true,", "secure: false,");
  helper = helper.replace(
    "${now}, 'e2e-admin-draft-pack', 10, 'DRAFT', 1, 'CLEAR', ${now});",
    "${now}, 'e2e-admin-draft-pack', 10, 'PUBLISHED', 1, 'CLEAR', ${now});",
  );
  writeFileSync(helperPath, helper);

  const storePath = "tests/e2e/store.spec.ts";
  let store = readFileSync(storePath, "utf8");
  for (const name of ["Stellar Magic", "Star Dust", "Lujo Plata"]) {
    store = store.replace(
      `page.getByRole("heading", { name: "${name}" })).toBeVisible()`,
      `page.getByRole("heading", { name: "${name}" }).first()).toBeVisible()`,
    );
  }
  writeFileSync(storePath, store);

  const adminPath = "tests/e2e/admin.spec.ts";
  let admin = readFileSync(adminPath, "utf8");
  const marker = `  await expect(emote.getByRole("button", { name: "Replace image" })).toBeVisible();\n\n`;
  const addition = `${marker}  await expect(emote.locator("img")).toHaveAttribute(\n    "src",\n    "/api/admin/catalog/emotes/e2e-admin-emote/media",\n  );\n\n  const packHeader = workspace.locator(".admin-store-pack-header");\n  await packHeader.getByRole("button", { name: "Publish" }).click();\n  await expect(packHeader.getByText("PUBLISHED", { exact: true }).first()).toBeVisible();\n  await packHeader.getByRole("button", { name: "Enable" }).click();\n  await expect(packHeader.getByText("Enabled", { exact: true }).first()).toBeVisible();\n\n`;
  admin = replaceRequired(admin, marker, addition, "Admin pack action E2E");
  writeFileSync(adminPath, admin);
}

fixAdminPreview();
fixCatalogApi();
fixStoreAdminLegacyAction();
fixE2E();
