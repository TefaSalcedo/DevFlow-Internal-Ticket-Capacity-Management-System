CREATE OR REPLACE FUNCTION public.email_exists_for_login(input_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(input_email)
      AND deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists_for_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists_for_login(text) TO anon;
GRANT EXECUTE ON FUNCTION public.email_exists_for_login(text) TO authenticated;
