DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'boards'
  ) THEN
    CREATE TABLE public.boards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      order_index integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (team_id, name)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boards_team_id_order_index_key'
  ) THEN
    ALTER TABLE public.boards
    ADD CONSTRAINT boards_team_id_order_index_key UNIQUE (team_id, order_index);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
      AND column_name = 'board_id'
  ) THEN
    ALTER TABLE public.tickets
    ADD COLUMN board_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_board_id_fkey'
  ) THEN
    ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_board_id_fkey
      FOREIGN KEY (board_id) REFERENCES public.boards(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_team_membership(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = target_team_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_team_membership(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_board_company_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  team_company_id uuid;
BEGIN
  SELECT t.company_id
  INTO team_company_id
  FROM public.teams t
  WHERE t.id = NEW.team_id;

  IF team_company_id IS NULL THEN
    RAISE EXCEPTION 'Board team does not exist';
  END IF;

  IF team_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'Board company mismatch with team company';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ticket_board_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  board_company_id uuid;
  board_team_id uuid;
BEGIN
  IF NEW.board_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.company_id, b.team_id
  INTO board_company_id, board_team_id
  FROM public.boards b
  WHERE b.id = NEW.board_id;

  IF board_company_id IS NULL THEN
    RAISE EXCEPTION 'Ticket board does not exist';
  END IF;

  IF NEW.company_id <> board_company_id THEN
    RAISE EXCEPTION 'Ticket company does not match board company';
  END IF;

  NEW.team_id := board_team_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boards_updated_at ON public.boards;
CREATE TRIGGER trg_boards_updated_at
BEFORE UPDATE ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_boards_company_match ON public.boards;
CREATE TRIGGER trg_boards_company_match
BEFORE INSERT OR UPDATE OF company_id, team_id
ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_company_match();

DROP TRIGGER IF EXISTS trg_tickets_board_scope ON public.tickets;
CREATE TRIGGER trg_tickets_board_scope
BEFORE INSERT OR UPDATE OF company_id, team_id, board_id
ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_board_scope();

INSERT INTO public.boards (company_id, team_id, name, description, order_index)
SELECT t.company_id, t.id, 'Main Board', 'Default board for migrated tickets', 0
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.boards b
  WHERE b.team_id = t.id
);

UPDATE public.tickets tk
SET team_id = (
  SELECT t.id
  FROM public.teams t
  WHERE t.company_id = tk.company_id
  ORDER BY t.created_at ASC
  LIMIT 1
)
WHERE tk.team_id IS NULL;

UPDATE public.tickets tk
SET board_id = (
  SELECT b.id
  FROM public.boards b
  WHERE b.team_id = tk.team_id
  ORDER BY b.order_index ASC, b.created_at ASC
  LIMIT 1
)
WHERE tk.board_id IS NULL
  AND tk.team_id IS NOT NULL;

UPDATE public.tickets tk
SET team_id = b.team_id
FROM public.boards b
WHERE tk.board_id = b.id
  AND tk.team_id IS DISTINCT FROM b.team_id;

CREATE INDEX IF NOT EXISTS idx_boards_company_team_order
  ON public.boards (company_id, team_id, order_index);

CREATE INDEX IF NOT EXISTS idx_tickets_company_team_board_status
  ON public.tickets (company_id, team_id, board_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_board_priority
  ON public.tickets (board_id, priority);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user_ticket
  ON public.ticket_assignees (user_id, ticket_id);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boards_select ON public.boards;
CREATE POLICY boards_select
ON public.boards
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS boards_insert ON public.boards;
CREATE POLICY boards_insert
ON public.boards
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS boards_update ON public.boards;
CREATE POLICY boards_update
ON public.boards
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

DROP POLICY IF EXISTS boards_delete ON public.boards;
CREATE POLICY boards_delete
ON public.boards
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS tickets_select ON public.tickets;
CREATE POLICY tickets_select
ON public.tickets
FOR SELECT
USING (
  public.is_super_admin()
  OR (
    public.has_company_role(
      company_id,
      ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
    )
    AND (
      public.has_company_role(
        company_id,
        ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
      )
      OR team_id IS NULL
      OR public.has_team_membership(team_id)
      OR EXISTS (
        SELECT 1
        FROM public.ticket_assignees ta
        WHERE ta.ticket_id = tickets.id
          AND ta.company_id = tickets.company_id
          AND ta.user_id = auth.uid()
      )
    )
  )
);
