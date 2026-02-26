CREATE TABLE IF NOT EXISTS public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  field_name text,
  from_value text,
  to_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_created_at
  ON public.ticket_history (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_history_company_created_at
  ON public.ticket_history (company_id, created_at DESC);

ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_history_select ON public.ticket_history;
CREATE POLICY ticket_history_select
ON public.ticket_history
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS ticket_history_insert ON public.ticket_history;
CREATE POLICY ticket_history_insert
ON public.ticket_history
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);
