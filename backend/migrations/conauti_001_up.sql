BEGIN;

CREATE TABLE IF NOT EXISTS conauti_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conauti_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES conauti_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS conauti_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES conauti_users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conauti_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL
    REFERENCES conauti_conversations(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL
    CHECK (role IN ('user','assistant')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conauti_conversations_user
ON conauti_conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conauti_messages_conversation
ON conauti_messages(conversation_id, id);

COMMIT;
