BEGIN;

CREATE TABLE IF NOT EXISTS conauti_ai_requests (
    request_id UUID PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES conauti_users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL
        REFERENCES conauti_conversations(id) ON DELETE CASCADE,
    prompt_hash CHAR(64) NOT NULL,
    user_message_id BIGINT NOT NULL
        REFERENCES conauti_messages(id) ON DELETE CASCADE,
    assistant_message_id BIGINT NOT NULL
        REFERENCES conauti_messages(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conauti_ai_user_date
ON conauti_ai_requests(user_id, created_at DESC);

COMMIT;
