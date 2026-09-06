-- Custom SQL migration file, put your code below! --
-- Phase 4A: the canonical policy grants audited anonymous-author lookup to
-- Admin and Owner. Phase 2 intentionally withheld it from the initial admin
-- seed; this forward-only migration applies the later product decision.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'admin', id FROM permissions
  WHERE slug = 'anonymous_post.deanonymize';
