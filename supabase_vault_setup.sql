-- Supabase Vault Setup: Create wrapper functions in public schema
-- Run this in your Supabase SQL Editor
-- 
-- IMPORTANT: Before running this SQL:
-- 1. Go to Database → Extensions in your Supabase dashboard
-- 2. Enable the "supabase_vault" extension (search for "vault")
-- 3. Then run this SQL
--
-- Alternatively, you can enable it via SQL:
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Wrapper for vault.create_secret
-- This function is accessible via PostgREST at /rpc/vault_create_secret
CREATE OR REPLACE FUNCTION public.vault_create_secret(
  secret text,
  name text DEFAULT NULL,
  description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_id uuid;
BEGIN
  -- Call the actual vault.create_secret function
  secret_id := vault.create_secret(secret, name, description);
  RETURN secret_id;
END;
$$;

-- Wrapper for vault.update_secret
CREATE OR REPLACE FUNCTION public.vault_update_secret(
  secret_id uuid,
  secret text,
  name text DEFAULT NULL,
  description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  -- Call the actual vault.update_secret function
  PERFORM vault.update_secret(secret_id, secret, name, description);
END;
$$;

-- Wrapper for deleting secrets
CREATE OR REPLACE FUNCTION public.vault_delete_secret(
  secret_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  -- Delete from vault.secrets table
  -- Note: Vault extension doesn't provide vault.delete_secret()
  DELETE FROM vault.secrets WHERE id = secret_id;
END;
$$;

-- Wrapper for getting decrypted secrets
CREATE OR REPLACE FUNCTION public.vault_get_secret(
  secret_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value text;
BEGIN
  -- Query the decrypted_secrets view
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  RETURN secret_value;
END;
$$;

-- Grant execute permissions
-- Adjust these based on your security requirements
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_get_secret(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_get_secret(uuid) FROM authenticated;

-- Verify the functions were created
SELECT 
  routine_name, 
  routine_schema,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'vault_%'
ORDER BY routine_name;
