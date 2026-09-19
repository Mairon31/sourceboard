CREATE TABLE user_pack_equips (
  user_id TEXT NOT NULL,
  store_item_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, store_item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (store_item_id) REFERENCES store_items(id) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX user_pack_equips_user_updated_index
  ON user_pack_equips (user_id, updated_at);

INSERT OR IGNORE INTO user_pack_equips (user_id, store_item_id, updated_at)
SELECT i.user_id, i.store_item_id, i.acquired_at
FROM user_inventory i
JOIN store_items s ON s.id = i.store_item_id
WHERE s.type IN ('EMOTE_PACK', 'STICKER_PACK');
