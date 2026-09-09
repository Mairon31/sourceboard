from pathlib import Path

api_path = Path("worker/catalog/api.ts")
types_path = Path("app/components/admin/store/types.ts")
ui_path = Path("app/components/admin/store/AdminEmotePackManager.tsx")
css_path = Path("app/components/admin/store/admin-store.css")

api = api_path.read_text()
types = types_path.read_text()
ui = ui_path.read_text()
css = css_path.read_text()

normal_old = """              s.is_featured AS isFeatured, s.is_active AS isActive, COUNT(e.id) AS emoteCount
       FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
"""
normal_new = """              s.is_featured AS isFeatured, s.is_active AS isActive,
              (SELECT preview.id FROM emote_catalog preview WHERE preview.pack_id = p.id ORDER BY preview.sort_order ASC, preview.created_at ASC LIMIT 1) AS previewEmoteId,
              COUNT(e.id) AS emoteCount
       FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
"""
if normal_old in api:
    api = api.replace(normal_old, normal_new, 1)
elif "AS previewEmoteId" not in api:
    raise SystemExit("modern pack summary query anchor not found")

legacy_old = """            s.is_active AS storeEnabled, 0 AS isFeatured, s.is_active AS isActive, COUNT(e.id) AS emoteCount
     FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
"""
legacy_new = """            s.is_active AS storeEnabled, 0 AS isFeatured, s.is_active AS isActive,
            (SELECT preview.id FROM emote_catalog preview WHERE preview.pack_id = p.id ORDER BY preview.sort_order ASC, preview.created_at ASC LIMIT 1) AS previewEmoteId,
            COUNT(e.id) AS emoteCount
     FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
"""
if legacy_old in api:
    api = api.replace(legacy_old, legacy_new, 1)
elif api.count("AS previewEmoteId") < 2:
    raise SystemExit("legacy pack summary query anchor not found")

type_anchor = """  isFeatured: boolean | number | null;
  emoteCount: number;
"""
type_replacement = """  isFeatured: boolean | number | null;
  previewEmoteId: string | null;
  emoteCount: number;
"""
if type_anchor in types:
    types = types.replace(type_anchor, type_replacement, 1)
elif "previewEmoteId: string | null;" not in types:
    raise SystemExit("pack summary type anchor not found")

ui_old = r'''              <button
                key={pack.id}
                type="button"
                className={`admin-store-pack-list__item${active ? " admin-store-pack-list__item--active" : ""}`}
                onClick={() => onSelectPack(pack.id)}
              >
                <span>
                  <strong>{pack.label}</strong>
                  <small>{pack.slug}</small>
                </span>
                <span className="admin-store-pack-list__meta">
                  <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                  <Badge tone={truthy(pack.isEnabled) ? "success" : "neutral"}>
                    {truthy(pack.isEnabled) ? "Enabled" : "Disabled"}
                  </Badge>
                  <small>
                    {pack.storeLifecycleState
                      ? `Store ${pack.storeLifecycleState}`
                      : "No Store offering"}
                  </small>
                  <small>{pack.emoteCount} emotes</small>
                </span>
              </button>
'''
ui_new = r'''              <button
                key={pack.id}
                type="button"
                className={`admin-store-pack-list__item${active ? " admin-store-pack-list__item--active" : ""}`}
                onClick={() => onSelectPack(pack.id)}
              >
                <span className="admin-store-pack-list__preview" aria-hidden="true">
                  {pack.previewEmoteId ? (
                    <img
                      src={`/api/admin/catalog/emotes/${encodeURIComponent(pack.previewEmoteId)}/media`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span>No preview</span>
                  )}
                </span>
                <span className="admin-store-pack-list__summary">
                  <span className="admin-store-pack-list__title">
                    <strong>{pack.label}</strong>
                    <small>{pack.slug}</small>
                  </span>
                  <small className="admin-store-pack-list__description">
                    {pack.description || "No description."}
                  </small>
                  <span className="admin-store-pack-list__meta">
                    <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                    <Badge tone={truthy(pack.isEnabled) ? "success" : "neutral"}>
                      {truthy(pack.isEnabled) ? "Enabled" : "Disabled"}
                    </Badge>
                  </span>
                  <span className="admin-store-pack-list__facts">
                    <small>{pack.pricePoints === 0 ? "Free" : `${pack.pricePoints ?? 0} pts`}</small>
                    <small>
                      Store visibility: {pack.storeLifecycleState ?? "No offering"}
                      {pack.storeLifecycleState
                        ? truthy(pack.storeEnabled)
                          ? " / enabled"
                          : " / disabled"
                        : ""}
                    </small>
                    <small>{pack.emoteCount} emotes</small>
                  </span>
                </span>
              </button>
'''
if ui_old in ui:
    ui = ui.replace(ui_old, ui_new, 1)
elif "pack.previewEmoteId" not in ui:
    raise SystemExit("pack list UI anchor not found")

css_anchor = """.admin-store-pack-list__meta {
  display: grid;
  flex: 0 0 auto;
  justify-items: end;
  gap: 4px;
}
"""
css_addition = """

.admin-store-pack-list__item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: start;
}

.admin-store-pack-list__preview {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-app-secondary);
}

.admin-store-pack-list__preview img {
  width: 82%;
  height: 82%;
  object-fit: contain;
}

.admin-store-pack-list__preview > span {
  padding: 4px;
  color: var(--text-muted);
  font-size: 9px;
  line-height: 1.1;
  text-align: center;
}

.admin-store-pack-list__summary,
.admin-store-pack-list__title,
.admin-store-pack-list__facts {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.admin-store-pack-list__description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal !important;
}

.admin-store-pack-list__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
}

.admin-store-pack-list__facts {
  margin-top: 2px;
}
"""
if css_addition.strip() not in css:
    if css_anchor not in css:
        raise SystemExit("pack list CSS anchor not found")
    css = css.replace(css_anchor, css_anchor + css_addition, 1)

api_path.write_text(api)
types_path.write_text(types)
ui_path.write_text(ui)
css_path.write_text(css)
