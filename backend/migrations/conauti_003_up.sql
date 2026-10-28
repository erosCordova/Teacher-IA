BEGIN;

CREATE INDEX IF NOT EXISTS idx_conauti_historial_orden
ON conauti_conversations (
    user_id,
    created_at DESC,
    id DESC
);

CREATE INDEX IF NOT EXISTS idx_conauti_mensajes_orden
ON conauti_messages (
    conversation_id,
    id DESC
);

COMMIT;
