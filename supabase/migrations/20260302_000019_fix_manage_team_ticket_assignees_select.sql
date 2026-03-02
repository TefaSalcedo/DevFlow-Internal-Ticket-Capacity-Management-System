-- Fix My Tasks visibility for MANAGE_TEAM users.
-- Root cause: ticket_assignees_select policy did not include MANAGE_TEAM.

DROP POLICY IF EXISTS ticket_assignees_select ON public.ticket_assignees;
CREATE POLICY ticket_assignees_select
ON public.ticket_assignees
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);
