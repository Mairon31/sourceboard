UPDATE user_profiles
SET profile_visibility = 'PUBLIC', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE profile_visibility <> 'PUBLIC';

ALTER TABLE sessions ADD COLUMN ip_encrypted TEXT;
ALTER TABLE sessions ADD COLUMN ip_key_version TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN cf_city TEXT;
ALTER TABLE sessions ADD COLUMN cf_region TEXT;
ALTER TABLE sessions ADD COLUMN cf_country TEXT;
ALTER TABLE sessions ADD COLUMN context_updated_at INTEGER;
