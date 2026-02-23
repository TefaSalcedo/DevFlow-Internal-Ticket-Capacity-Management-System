DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_workflow_stage') THEN
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'DESIGN';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'BUG';
  END IF;
END $$;

DROP POLICY IF EXISTS company_memberships_select ON public.company_memberships;
CREATE POLICY company_memberships_select
ON public.company_memberships
FOR SELECT
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

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
    WHERE target_membership.user_id = id
      AND target_membership.is_active = true
      AND public.has_company_role(
        target_membership.company_id,
        ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
      )
  )
);
