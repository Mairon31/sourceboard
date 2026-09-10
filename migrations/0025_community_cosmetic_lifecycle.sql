ALTER TABLE cosmetic_submission_reviews ADD COLUMN community_state TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
  CHECK (community_state IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'));
ALTER TABLE cosmetic_submission_reviews ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR'
  CHECK (moderation_state IN ('CLEAR', 'HIDDEN', 'REMOVED'));
ALTER TABLE cosmetic_submission_reviews ADD COLUMN published_at INTEGER;
ALTER TABLE cosmetic_submission_reviews ADD COLUMN archived_at INTEGER;

-- Legacy approvals were intentionally not public. Re-review them under the new publish-on-approval contract.
UPDATE cosmetic_submission_reviews
SET review_state = 'PENDING_REVIEW', community_state = 'PENDING_REVIEW', reviewed_by_user_id = NULL, reviewed_at = NULL
WHERE review_state = 'APPROVED';
UPDATE cosmetic_submission_reviews SET community_state = 'REJECTED' WHERE review_state = 'REJECTED';

CREATE INDEX cosmetic_submission_reviews_public_index
  ON cosmetic_submission_reviews (community_state, moderation_state, review_state, created_at);
