-- Roles base de My Teacher IA
-- Sin cuentas de estudiantes ni datos personales.

INSERT INTO public.conauti_roles (code, description)
VALUES
    ('student', 'Estudiante'),
    ('teacher', 'Docente'),
    ('admin', 'Administrador')
ON CONFLICT (code) DO NOTHING;
