-- Script para agregar el primer usuario administrador
-- Ejecuta este script en el SQL Editor de Supabase

-- INSTRUCCIONES:
-- 1. Primero crea una cuenta normal usando signup.html
-- 2. Luego reemplaza 'tu-email@ejemplo.com' con el email que usaste
-- 3. Ejecuta este script en Supabase SQL Editor

-- Agregar el primer admin (esto omite la política de seguridad temporalmente)
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Buscar el ID del usuario por email
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'tu-email@ejemplo.com';
    
    -- Verificar que el usuario existe
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado. Verifica el email.';
    END IF;
    
    -- Insertar en la tabla admins
    INSERT INTO admins (user_id)
    VALUES (admin_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Usuario admin agregado exitosamente: %', admin_user_id;
END $$;

-- Verificar que el admin fue agregado correctamente
SELECT 
    a.id as admin_id,
    a.user_id,
    au.email,
    a.created_at
FROM admins a
JOIN auth.users au ON au.id = a.user_id;
