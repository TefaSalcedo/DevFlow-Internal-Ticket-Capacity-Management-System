DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;

CREATE POLICY user_profiles_select
ON public.user_profiles
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.company_memberships target_membership
    WHERE target_membership.user_id = user_profiles.id
      AND target_membership.is_active = true
      AND public.has_company_role(
        target_membership.company_id,
        ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
      )
  )
);
