-- Migration: Fix user_profiles INSERT policy to allow trigger to create profiles
-- Description: The handle_new_auth_user trigger was failing with 403 Forbidden
-- because the INSERT policy was too restrictive. This fix allows the trigger to work.

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;

-- Create a more permissive INSERT policy that allows:
-- 1. Users to insert their own profile (id = auth.uid())
-- 2. Super admins to insert any profile
-- 3. Service role (for triggers) to insert profiles
CREATE POLICY user_profiles_insert
ON public.user_profiles
FOR INSERT
WITH CHECK (
  id = auth.uid()
  OR public.is_super_admin()
  -- Allow service role (trigger context) to insert
  OR (auth.role() = 'service_role')
);

-- Add comment to explain the policy
COMMENT ON POLICY user_profiles_insert ON public.user_profiles IS 
  'Allows users to insert their own profile, super admins to insert any profile, 
   and service role (triggers) to insert profiles during user creation.';
