BEGIN;

DROP TABLE IF EXISTS conauti_progress;
DROP TABLE IF EXISTS conauti_memories;

DROP TRIGGER IF EXISTS conauti_user_default_role
ON conauti_users;

DROP FUNCTION IF EXISTS conauti_default_role();

DROP TABLE IF EXISTS conauti_user_roles;
DROP TABLE IF EXISTS conauti_roles;

COMMIT;
