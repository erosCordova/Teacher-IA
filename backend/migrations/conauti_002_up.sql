BEGIN;

CREATE TABLE IF NOT EXISTS conauti_roles (
  code VARCHAR(16) PRIMARY KEY,
  description TEXT NOT NULL,
  CONSTRAINT conauti_roles_code_valid
  CHECK (code IN ('student', 'teacher', 'admin'))
);

INSERT INTO conauti_roles(code, description)
VALUES
  ('student', 'Estudiante'),
  ('teacher', 'Docente'),
  ('admin', 'Administrador')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS conauti_user_roles (
  user_id UUID NOT NULL
    REFERENCES conauti_users(id) ON DELETE CASCADE,
  role_code VARCHAR(16) NOT NULL
    REFERENCES conauti_roles(code),
  PRIMARY KEY (user_id, role_code)
);

INSERT INTO conauti_user_roles(user_id, role_code)
SELECT id, 'student'
FROM conauti_users
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION conauti_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO conauti_user_roles(user_id, role_code)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conauti_user_default_role
ON conauti_users;

CREATE TRIGGER conauti_user_default_role
AFTER INSERT ON conauti_users
FOR EACH ROW
EXECUTE FUNCTION conauti_default_role();

CREATE TABLE IF NOT EXISTS conauti_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES conauti_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_message_id BIGINT
    REFERENCES conauti_messages(id) ON DELETE SET NULL,
  consent_granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conauti_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES conauti_users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(150) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
    CHECK (attempts >= 0),
  score NUMERIC(5,2)
    CHECK (score >= 0 AND score <= 100),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conauti_memories_user
ON conauti_memories(user_id);

CREATE INDEX IF NOT EXISTS idx_conauti_progress_user
ON conauti_progress(user_id, recorded_at DESC);

COMMIT;
