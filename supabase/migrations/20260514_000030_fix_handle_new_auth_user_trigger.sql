-- Migration: Fix handle_new_auth_user trigger to bypass RLS
-- Description: The trigger was failing because RLS policies are evaluated AFTER the trigger executes,
-- even with SECURITY DEFINER. This fix uses SET LOCAL to temporarily bypass RLS within the trigger.

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;

-- Recreate the trigger function with SET LOCAL to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_token text;
  invite_company_id uuid;
  invite_role public.company_role;
BEGIN
  -- Temporarily bypass RLS for this transaction
  SET LOCAL session_replication_role = 'replica';
  
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();

  invite_token := nullif(trim(coalesce(new.raw_user_meta_data ->> 'invite_token', '')), '');

  if invite_token is not null then
    select cil.company_id, cil.role
      into invite_company_id, invite_role
    from public.company_invite_links cil
    where cil.token = invite_token
      and cil.is_active = true
      and (cil.expires_at is null or cil.expires_at > now())
    limit 1;

    if invite_company_id is not null then
      insert into public.company_memberships (company_id, user_id, role, is_active)
      values (invite_company_id, new.id, invite_role, true)
      on conflict (company_id, user_id) do update
        set role = excluded.role,
            is_active = true,
            updated_at = now();
    end if;
  end if;

  return new;
END;
$$;

-- Re-create the trigger
DROP TRIGGER IF EXISTS trigger_handle_new_auth_user ON auth.users;
CREATE TRIGGER trigger_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Add comments
COMMENT ON FUNCTION public.handle_new_auth_user() IS 
  'Creates user profile and processes invite tokens. Uses SET LOCAL session_replication_role to bypass RLS within the trigger.';

COMMENT ON TRIGGER trigger_handle_new_auth_user ON auth.users IS 
  'Fires after user creation to create profile and process invite tokens.';
