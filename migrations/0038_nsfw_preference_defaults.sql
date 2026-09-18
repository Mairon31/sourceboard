-- Keep public NSFW posts discoverable while blurring their media by default.
-- Preserve rows that are not still on the previous default pair.
UPDATE user_preferences
SET hide_nsfw = 0,
    blur_nsfw = 1
WHERE hide_nsfw = 1
  AND blur_nsfw = 1;
