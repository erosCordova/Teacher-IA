-- My Teacher IA: registro con Google, migración aditiva y sin pérdida de datos.
-- Se ejecuta dentro de la ruta verificada mediante CREATE TABLE IF NOT EXISTS,
-- pero este SQL permite aplicar la misma estructura explícitamente si se requiere.
BEGIN;

CREATE TABLE IF NOT EXISTS conauti_google_accounts (
    google_sub VARCHAR(255) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_conauti_google_email_normalized CHECK (email = LOWER(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conauti_google_email_ci
ON conauti_google_accounts (LOWER(email));

COMMIT;
