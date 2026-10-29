-- My Teacher IA: identidad verificada separada del nombre visible.
-- Compatible con cuentas Google, Microsoft y correo; no altera credenciales.
BEGIN;

CREATE TABLE IF NOT EXISTS conauti_user_profiles (
    user_id UUID PRIMARY KEY REFERENCES conauti_users(id) ON DELETE CASCADE,
    display_name VARCHAR(60) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
