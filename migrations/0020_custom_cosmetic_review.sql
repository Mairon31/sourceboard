CREATE TABLE cosmetic_submission_reviews (
  store_item_id TEXT PRIMARY KEY NOT NULL,
  submitted_by_user_id TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (review_state IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  review_note TEXT,
  reviewed_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  FOREIGN KEY (store_item_id) REFERENCES store_items(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX cosmetic_submission_reviews_state_created_index
  ON cosmetic_submission_reviews (review_state, created_at);

CREATE INDEX cosmetic_submission_reviews_submitter_created_index
  ON cosmetic_submission_reviews (submitted_by_user_id, created_at);
