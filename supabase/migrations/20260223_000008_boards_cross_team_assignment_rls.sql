DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'teams'
  ) THEN
    CREATE TABLE public.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      name text NOT NULL,
      capacity_default numeric(6,2) DEFAULT 44,
      created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (company_id, name)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'capacity_default'
  ) THEN
    ALTER TABLE public.teams
    ADD COLUMN capacity_default numeric(6,2) DEFAULT 44;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
  ) THEN
    CREATE TABLE public.team_members (
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
      is_active boolean NOT NULL DEFAULT true,
      assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    );
  END IF;
END $$;

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
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'boards'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.boards
    ADD COLUMN description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'boards'
      AND column_name = 'order_index'
  ) THEN
    ALTER TABLE public.boards
    ADD COLUMN order_index integer NOT NULL DEFAULT 0;
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
      AND column_name = 'team_id'
  ) THEN
    ALTER TABLE public.tickets
    ADD COLUMN team_id uuid;
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
    WHERE conname = 'tickets_team_id_fkey'
  ) THEN
    ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
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

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

INSERT INTO public.teams (company_id, name, created_by)
SELECT c.id, 'Development', c.created_by
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.teams t
  WHERE t.company_id = c.id
);

INSERT INTO public.boards (company_id, team_id, name, description, order_index)
SELECT t.company_id, t.id, 'Main Board', 'Default board for migrated tickets', 0
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.boards b
  WHERE b.team_id = t.id
);

UPDATE public.tickets tk
SET team_id = b.team_id
FROM public.boards b
WHERE tk.board_id = b.id
  AND tk.team_id IS NULL;

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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE team_id IS NULL) THEN
    ALTER TABLE public.tickets ALTER COLUMN team_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE board_id IS NULL) THEN
    ALTER TABLE public.tickets ALTER COLUMN board_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_members_team_active
  ON public.team_members (team_id, is_active);

CREATE INDEX IF NOT EXISTS idx_team_members_company_user
  ON public.team_members (company_id, user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_boards_company_team_order
  ON public.boards (company_id, team_id, order_index);

CREATE INDEX IF NOT EXISTS idx_tickets_company_team_board_status
  ON public.tickets (company_id, team_id, board_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_board_priority
  ON public.tickets (board_id, priority);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user_ticket
  ON public.ticket_assignees (user_id, ticket_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select
ON public.teams
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert
ON public.teams
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update
ON public.teams
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete
ON public.teams
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select
ON public.team_members
FOR SELECT
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert
ON public.team_members
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

DROP POLICY IF EXISTS team_members_update ON public.team_members;
CREATE POLICY team_members_update
ON public.team_members
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete
ON public.team_members
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN']::public.company_role[]
  )
);

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
