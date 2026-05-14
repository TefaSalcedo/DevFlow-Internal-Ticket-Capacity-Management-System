-- Migration: Fix user_profiles INSERT policy to allow users to insert their own profile
-- Description: Since we cannot modify triggers in auth.users (requires owner permissions),
-- we modify the INSERT policy to allow users to insert their own profile (id = auth.uid()).

-- Drop the previous restrictive INSERT policy
DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;

-- Create a more permissive INSERT policy that allows users to insert their own profile
CREATE POLICY user_profiles_insert
ON public.user_profiles
FOR INSERT
WITH CHECK (
  id = auth.uid()
  OR public.is_super_admin()
);

-- Add comment to explain the policy
COMMENT ON POLICY user_profiles_insert ON public.user_profiles IS 
  'Allows users to insert their own profile (id = auth.uid()) or super admins to insert any profile.
   This enables the handle_new_auth_user trigger to create profiles during signup.';
