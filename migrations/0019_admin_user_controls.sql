INSERT OR IGNORE INTO permissions (id, slug, description)
VALUES ('user.delete', 'user.delete', 'Anonymize a user account and revoke access');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'owner', 'user.delete'
WHERE EXISTS (SELECT 1 FROM roles WHERE id = 'owner')
  AND EXISTS (SELECT 1 FROM permissions WHERE id = 'user.delete');
