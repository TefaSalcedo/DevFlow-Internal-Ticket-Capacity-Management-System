-- Allow MANAGE_TEAM to read companies in scope.

DROP POLICY IF EXISTS companies_select ON public.companies;

CREATE POLICY companies_select ON public.companies
  FOR SELECT
  USING (
    is_super_admin()
    OR has_company_role(
      id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role,
        'READER'::company_role
      ]
    )
  );
