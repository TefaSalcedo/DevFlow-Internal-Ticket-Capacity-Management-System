-- Align meetings RLS with application permissions for MANAGE_TEAM users.

DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select
ON public.meetings
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS meetings_insert ON public.meetings;
CREATE POLICY meetings_insert
ON public.meetings
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS meetings_update ON public.meetings;
CREATE POLICY meetings_update
ON public.meetings
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
);
