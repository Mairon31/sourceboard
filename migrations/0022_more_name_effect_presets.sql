INSERT OR IGNORE INTO store_items
(id, type, name, description, price_points, config_json, is_active, lifecycle_state, is_enabled, is_featured, sort_order, created_at, updated_at)
VALUES
('store-name-effect-hologram', 'NAME_EFFECT', 'Hologram', 'A spectral cyan-violet holographic sweep with a crisp luminous edge.', 3600, '{"preset":"hologram"}', 1, 'PUBLISHED', 1, 1, 620, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-void', 'NAME_EFFECT', 'Void', 'A restrained ultraviolet shadow treatment with a deep-space outline.', 2800, '{"preset":"void"}', 1, 'PUBLISHED', 1, 0, 630, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-solar', 'NAME_EFFECT', 'Solar Flare', 'A bright white-gold solar treatment with a warm corona pulse.', 4200, '{"preset":"solar"}', 1, 'PUBLISHED', 1, 1, 640, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-candy', 'NAME_EFFECT', 'Candy Stripe', 'A playful but clean pink-cyan diagonal stripe treatment.', 2400, '{"preset":"candy"}', 1, 'PUBLISHED', 1, 0, 650, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-terminal', 'NAME_EFFECT', 'Terminal Scan', 'A monochrome terminal-green scan treatment with a subtle digital flicker.', 3000, '{"preset":"terminal"}', 1, 'PUBLISHED', 1, 0, 660, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-chrome', 'NAME_EFFECT', 'Liquid Chrome', 'A metallic silver-blue display-name finish with a moving reflective highlight.', 5000, '{"preset":"chrome"}', 1, 'PUBLISHED', 1, 1, 670, unixepoch('now') * 1000, unixepoch('now') * 1000);
