BEGIN;

CREATE TABLE IF NOT EXISTS conauti_pedagogy_state (
    conversation_id UUID PRIMARY KEY
        REFERENCES conauti_conversations(id) ON DELETE CASCADE,
    hint_level INTEGER NOT NULL DEFAULT 0
        CHECK (hint_level BETWEEN 0 AND 3),
    no_hints BOOLEAN NOT NULL DEFAULT FALSE,
    last_intent VARCHAR(32) NOT NULL DEFAULT 'concept',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conauti_pedagogy_events (
    message_id BIGINT PRIMARY KEY
        REFERENCES conauti_messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL
        REFERENCES conauti_conversations(id) ON DELETE CASCADE,
    intent VARCHAR(32) NOT NULL,
    hint_level INTEGER NOT NULL,
    no_hints BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conauti_pedagogy_events
ON conauti_pedagogy_events(conversation_id, created_at DESC);

COMMIT;
