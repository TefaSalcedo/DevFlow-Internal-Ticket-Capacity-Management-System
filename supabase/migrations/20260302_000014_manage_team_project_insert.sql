DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert
ON public.projects
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
);
