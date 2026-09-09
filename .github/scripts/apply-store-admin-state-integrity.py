from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "tests/unit/store-catalog-redesign.test.ts",
    '''    expect(storeRoute).toContain("featuredItems");
    expect(storeRoute).toContain("newItems");
    expect(storeRoute).toContain("ownedItems");''',
    '''    expect(storeRoute).toContain("partitionStoreItems");
    expect(storeRoute).toContain("sections.featured");
    expect(storeRoute).toContain("sections.newest");
    expect(storeRoute).toContain("sections.owned");''',
)

replace_once(
    "worker/store/admin.ts",
    '''      const metadata: Record<string, unknown> = {
        action,
        from: {
          lifecycleState: existing.lifecycleState,
          isEnabled: existing.isEnabled,
          isFeatured: existing.isFeatured,
        },
      };

      if (action === "DELETE") {''',
    '''      const metadata: Record<string, unknown> = {
        action,
        from: {
          lifecycleState: existing.lifecycleState,
          isEnabled: existing.isEnabled,
          isFeatured: existing.isFeatured,
        },
      };

      if (
        existing.lifecycleState === "ARCHIVED" &&
        (action === "PUBLISH" || action === "ENABLE" || action === "FEATURE")
      ) {
        throw new StoreError(
          409,
          "STORE_ITEM_ARCHIVED",
          "Restore this item to draft before publishing, enabling or featuring it.",
        );
      }

      if (action === "DELETE") {''',
)

replace_once(
    "worker/catalog/api.ts",
    '''  const isEnabled = legacyStatus
    ? legacyStatus === "ACTIVE"
    : ((body.isEnabled as boolean | undefined) ?? Number(current.isEnabled) === 1);
  const isGlobal = body.isGlobal === undefined ? Number(current.isGlobal) === 1 : body.isGlobal;

  if (lifecycleState === "PUBLISHED") {''',
    '''  let isEnabled = legacyStatus
    ? legacyStatus === "ACTIVE"
    : ((body.isEnabled as boolean | undefined) ?? Number(current.isEnabled) === 1);
  const isGlobal = body.isGlobal === undefined ? Number(current.isGlobal) === 1 : body.isGlobal;

  if (
    (current.lifecycleState === "ARCHIVED" && lifecycleState === "PUBLISHED") ||
    (lifecycleState === "ARCHIVED" && body.isEnabled === true)
  ) {
    return failure(
      "PACK_ARCHIVED",
      "Restore this pack to draft before publishing or enabling it.",
      requestId,
      409,
    );
  }
  if (lifecycleState === "ARCHIVED") isEnabled = false;

  if (lifecycleState === "PUBLISHED") {''',
)

replace_once(
    "worker/catalog/api.ts",
    '''  const isEnabled = body.isEnabled === undefined ? Number(current.isEnabled) === 1 : body.isEnabled;
  if (typeof isEnabled !== "boolean")
    return failure("INVALID_ENABLEMENT", "isEnabled must be boolean.", requestId, 400);
  if (body.lifecycleState !== undefined) {
    updates.push("lifecycle_state = ?");
    binds.push(lifecycleState);
  }
  if (body.isEnabled !== undefined) {
    updates.push("is_enabled = ?");
    binds.push(isEnabled ? 1 : 0);
  }''',
    '''  const currentEnabled = Number(current.isEnabled) === 1;
  let isEnabled = body.isEnabled === undefined ? currentEnabled : body.isEnabled;
  if (typeof isEnabled !== "boolean")
    return failure("INVALID_ENABLEMENT", "isEnabled must be boolean.", requestId, 400);
  if (
    (current.lifecycleState === "ARCHIVED" && lifecycleState === "PUBLISHED") ||
    (lifecycleState === "ARCHIVED" && body.isEnabled === true)
  ) {
    return failure(
      "EMOTE_ARCHIVED",
      "Restore this emote to draft before publishing or enabling it.",
      requestId,
      409,
    );
  }
  if (
    body.isEnabled === true &&
    (current.moderationState === "HIDDEN" || current.moderationState === "REMOVED")
  ) {
    return failure(
      "EMOTE_MODERATION_BLOCKED",
      "Hidden or removed emotes cannot be enabled until moderation permits it.",
      requestId,
      409,
    );
  }
  if (
    lifecycleState === "ARCHIVED" ||
    current.moderationState === "HIDDEN" ||
    current.moderationState === "REMOVED"
  ) {
    isEnabled = false;
  }
  if (body.lifecycleState !== undefined) {
    updates.push("lifecycle_state = ?");
    binds.push(lifecycleState);
  }
  if (body.isEnabled !== undefined || isEnabled !== currentEnabled) {
    updates.push("is_enabled = ?");
    binds.push(isEnabled ? 1 : 0);
  }''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''                onChange={(event) => setLifecycleState(event.target.value as StoreLifecycleState)}
              >''',
    '''                onChange={(event) => {
                  const next = event.target.value as StoreLifecycleState;
                  setLifecycleState(next);
                  if (next === "ARCHIVED") setEnabled(false);
                }}
              >''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>Enabled</span>''',
    '''              <input
                type="checkbox"
                checked={enabled}
                disabled={lifecycleState === "ARCHIVED"}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>{lifecycleState === "ARCHIVED" ? "Archived emotes stay disabled" : "Enabled"}</span>''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''                <span className="admin-store-pack-list__meta">
                  <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                  <small>{pack.emoteCount} emotes</small>
                </span>''',
    '''                <span className="admin-store-pack-list__meta">
                  <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                  <Badge tone={truthy(pack.isEnabled) ? "success" : "neutral"}>
                    {truthy(pack.isEnabled) ? "Enabled" : "Disabled"}
                  </Badge>
                  <small>{pack.storeLifecycleState ? `Store ${pack.storeLifecycleState}` : "No Store offering"}</small>
                  <small>{pack.emoteCount} emotes</small>
                </span>''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''  async function archiveStoreOffering() {
    if (!detail?.storeItemId || archiveReason.trim().length < 3) return;''',
    '''  async function updateStoreOffering(
    action: "FEATURE" | "UNFEATURE",
    successMessage: string,
  ) {
    if (!detail?.storeItemId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/store/${encodeURIComponent(detail.storeItemId)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this Store offering."));
        return;
      }
      onStatus(successMessage);
      await Promise.all([onRefreshPacks(), loadDetail()]);
    } catch {
      onStatus("Could not update this Store offering. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveStoreOffering() {
    if (!detail?.storeItemId || archiveReason.trim().length < 3) return;''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        void patchPack(
                          {
                            lifecycleState:
                              detail.lifecycleState === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                          },
                          detail.lifecycleState === "PUBLISHED"
                            ? "Pack unpublished."
                            : "Pack published.",
                        )
                      }
                    >
                      {detail.lifecycleState === "PUBLISHED" ? "Unpublish" : "Publish"}
                    </Button>''',
    '''                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        void patchPack(
                          detail.lifecycleState === "ARCHIVED"
                            ? { lifecycleState: "DRAFT", isEnabled: false }
                            : {
                                lifecycleState:
                                  detail.lifecycleState === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                              },
                          detail.lifecycleState === "ARCHIVED"
                            ? "Pack restored to draft."
                            : detail.lifecycleState === "PUBLISHED"
                              ? "Pack unpublished."
                              : "Pack published.",
                        )
                      }
                    >
                      {detail.lifecycleState === "ARCHIVED"
                        ? "Restore pack to draft"
                        : detail.lifecycleState === "PUBLISHED"
                          ? "Unpublish"
                          : "Publish"}
                    </Button>''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        void patchPack(
                          { isEnabled: !truthy(detail.isEnabled) },
                          truthy(detail.isEnabled) ? "Pack disabled." : "Pack enabled.",
                        )
                      }
                    >
                      {truthy(detail.isEnabled) ? "Disable" : "Enable"}
                    </Button>''',
    '''                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      disabled={detail.lifecycleState === "ARCHIVED"}
                      onClick={() =>
                        void patchPack(
                          { isEnabled: !truthy(detail.isEnabled) },
                          truthy(detail.isEnabled) ? "Pack disabled." : "Pack enabled.",
                        )
                      }
                    >
                      {detail.lifecycleState === "ARCHIVED"
                        ? "Archived"
                        : truthy(detail.isEnabled)
                          ? "Disable"
                          : "Enable"}
                    </Button>''',
)

replace_once(
    "app/components/admin/store/AdminEmotePackManager.tsx",
    '''                    {detail.storeItemId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setArchiving(true)}
                      >
                        Archive Store offering
                      </Button>
                    ) : null}''',
    '''                    {detail.storeItemId ? (
                      <>
                        {detail.storeLifecycleState === "ARCHIVED" ? (
                          <Button type="button" size="sm" variant="secondary" disabled>
                            Store archived
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            loading={busy}
                            onClick={() =>
                              void updateStoreOffering(
                                truthy(detail.isFeatured) ? "UNFEATURE" : "FEATURE",
                                truthy(detail.isFeatured)
                                  ? "Store offering unfeatured."
                                  : "Store offering featured.",
                              )
                            }
                          >
                            {truthy(detail.isFeatured)
                              ? "Unfeature Store offering"
                              : "Feature Store offering"}
                          </Button>
                        )}
                        {detail.storeLifecycleState !== "ARCHIVED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setArchiving(true)}
                          >
                            Archive Store offering
                          </Button>
                        ) : null}
                      </>
                    ) : null}''',
)
