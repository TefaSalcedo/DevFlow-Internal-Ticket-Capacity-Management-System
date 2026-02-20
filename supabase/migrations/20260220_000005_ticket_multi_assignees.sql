CREATE TABLE IF NOT EXISTS public.ticket_assignees (
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_company_user
  ON public.ticket_assignees (company_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket
  ON public.ticket_assignees (ticket_id);

INSERT INTO public.ticket_assignees (ticket_id, company_id, user_id, assigned_by)
SELECT t.id, t.company_id, t.assigned_to, t.created_by
FROM public.tickets t
WHERE t.assigned_to IS NOT NULL
ON CONFLICT (ticket_id, user_id) DO NOTHING;

ALTER TABLE public.ticket_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_assignees_select ON public.ticket_assignees;
CREATE POLICY ticket_assignees_select
ON public.ticket_assignees
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS ticket_assignees_insert ON public.ticket_assignees;
CREATE POLICY ticket_assignees_insert
ON public.ticket_assignees
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS ticket_assignees_delete ON public.ticket_assignees;
CREATE POLICY ticket_assignees_delete
ON public.ticket_assignees
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);
