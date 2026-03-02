DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role') THEN
    ALTER TYPE public.company_role ADD VALUE IF NOT EXISTS 'MANAGE_TEAM';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
      AND column_name = 'requester_team_id'
  ) THEN
    ALTER TABLE public.tickets
      ADD COLUMN requester_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
      AND column_name = 'cross_team_alert'
  ) THEN
    ALTER TABLE public.tickets
      ADD COLUMN cross_team_alert boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_team_cross_team_alert
  ON public.tickets (team_id, cross_team_alert, status);

DROP POLICY IF EXISTS tickets_select ON public.tickets;
CREATE POLICY tickets_select
ON public.tickets
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS tickets_insert ON public.tickets;
CREATE POLICY tickets_insert
ON public.tickets
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
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
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
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
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
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
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
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
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
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
    ARRAY['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR']::public.company_role[]
  )
);
