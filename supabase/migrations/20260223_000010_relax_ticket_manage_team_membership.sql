DROP POLICY IF EXISTS tickets_insert ON public.tickets;
CREATE POLICY tickets_insert
ON public.tickets
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS tickets_update ON public.tickets;
CREATE POLICY tickets_update
ON public.tickets
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS tickets_delete ON public.tickets;
CREATE POLICY tickets_delete
ON public.tickets
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);
