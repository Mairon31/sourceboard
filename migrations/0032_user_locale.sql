ALTER TABLE user_preferences ADD COLUMN locale TEXT
CHECK (locale IS NULL OR locale IN ('en','es','pt','fr','ru','de'));
