BEGIN;

CREATE TABLE IF NOT EXISTS conauti_voice_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES conauti_users(id) ON DELETE CASCADE,
    audio_bytes INTEGER NOT NULL
        CHECK (audio_bytes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_conauti_voice_usage
ON conauti_voice_usage(user_id, created_at DESC);

COMMIT;
