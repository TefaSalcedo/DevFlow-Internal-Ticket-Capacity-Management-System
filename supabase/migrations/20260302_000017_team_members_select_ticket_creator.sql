-- Allow ticket creators to read active team memberships across their company.

DROP POLICY IF EXISTS team_members_select ON public.team_members;

CREATE POLICY team_members_select ON public.team_members
  FOR SELECT
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role,
        'READER'::company_role
      ]
    )
  );
