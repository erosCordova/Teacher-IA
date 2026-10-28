-- My Teacher IA: proveedores de identidad verificados adicionales.
-- Migración aditiva, compatible con las cuentas Google existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS conauti_verified_email_identities (
    email VARCHAR(254) PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    provider VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_verified_provider CHECK (provider IN ('google','email','microsoft'))
);

CREATE TABLE IF NOT EXISTS conauti_email_challenges (
    email VARCHAR(254) PRIMARY KEY,
    mode VARCHAR(12) NOT NULL CHECK (mode IN ('register','login')),
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    hourly_window TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hourly_count INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_email_challenge_expiry
    ON conauti_email_challenges(expires_at);

CREATE TABLE IF NOT EXISTS conauti_microsoft_accounts (
    subject VARCHAR(255) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS conauti_microsoft_states (
    state_hash CHAR(64) PRIMARY KEY,
    mode VARCHAR(12) NOT NULL CHECK (mode IN ('register','login')),
    nonce VARCHAR(96) NOT NULL,
    verifier VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS conauti_microsoft_tickets (
    ticket_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES conauti_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_microsoft_tickets_expires
    ON conauti_microsoft_tickets(expires_at);

INSERT INTO conauti_verified_email_identities(email,user_id,provider)
SELECT LOWER(email),user_id,'google'
FROM conauti_google_accounts
ON CONFLICT (email) DO NOTHING;

COMMIT;
