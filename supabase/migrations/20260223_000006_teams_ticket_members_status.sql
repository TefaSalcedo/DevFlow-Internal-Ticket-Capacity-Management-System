DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'BUG'
      AND enumtypid = 'public.ticket_status'::regtype
  ) THEN
    ALTER TYPE public.ticket_status ADD VALUE 'BUG';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DESIGN'
      AND enumtypid = 'public.ticket_status'::regtype
  ) THEN
    ALTER TYPE public.ticket_status ADD VALUE 'DESIGN';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name),
  CONSTRAINT teams_name_check CHECK (
    name IN ('Development', 'Sales', 'Marketing', 'Design', 'Support', 'Management')
  )
);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_members_company_user
  ON public.team_members (company_id, user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_team_members_team_active
  ON public.team_members (team_id, is_active);

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_company_team_status
  ON public.tickets (company_id, team_id, status);

CREATE TABLE IF NOT EXISTS public.ticket_members (
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_members_company_user
  ON public.ticket_members (company_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_members_ticket
  ON public.ticket_members (ticket_id);

INSERT INTO public.teams (company_id, name)
SELECT c.id, team_name
FROM public.companies c
CROSS JOIN (
  VALUES
    ('Development'::text),
    ('Sales'::text),
    ('Marketing'::text),
    ('Design'::text),
    ('Support'::text),
    ('Management'::text)
) AS defaults(team_name)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.team_members (team_id, company_id, user_id, assigned_by)
SELECT t.id, cm.company_id, cm.user_id, cm.user_id
FROM public.company_memberships cm
JOIN public.user_profiles up ON up.id = cm.user_id
JOIN public.teams t ON t.company_id = cm.company_id AND t.name = 'Development'
WHERE cm.is_active = true
  AND up.global_role <> 'SUPER_ADMIN'
ON CONFLICT (team_id, user_id) DO NOTHING;

INSERT INTO public.ticket_members (ticket_id, company_id, user_id, assigned_by)
SELECT ta.ticket_id, ta.company_id, ta.user_id, ta.assigned_by
FROM public.ticket_assignees ta
JOIN public.user_profiles up ON up.id = ta.user_id
WHERE up.global_role <> 'SUPER_ADMIN'
ON CONFLICT (ticket_id, user_id) DO NOTHING;

INSERT INTO public.ticket_members (ticket_id, company_id, user_id, assigned_by)
SELECT t.id, t.company_id, t.assigned_to, t.created_by
FROM public.tickets t
JOIN public.user_profiles up ON up.id = t.assigned_to
WHERE t.assigned_to IS NOT NULL
  AND up.global_role <> 'SUPER_ADMIN'
ON CONFLICT (ticket_id, user_id) DO NOTHING;

UPDATE public.tickets t
SET assigned_to = NULL
FROM public.user_profiles up
WHERE t.assigned_to = up.id
  AND up.global_role = 'SUPER_ADMIN';

DELETE FROM public.ticket_members tm
USING public.user_profiles up
WHERE tm.user_id = up.id
  AND up.global_role = 'SUPER_ADMIN';

DELETE FROM public.team_members tm
USING public.user_profiles up
WHERE tm.user_id = up.id
  AND up.global_role = 'SUPER_ADMIN';

DELETE FROM public.company_memberships cm
USING public.user_profiles up
WHERE cm.user_id = up.id
  AND up.global_role = 'SUPER_ADMIN';

CREATE OR REPLACE FUNCTION public.is_non_super_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = target_user_id
      AND up.global_role <> 'SUPER_ADMIN'
  );
$$;

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

CREATE OR REPLACE FUNCTION public.prevent_super_admin_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_non_super_admin_user(NEW.user_id) THEN
    RAISE EXCEPTION 'SUPER_ADMIN users cannot be assigned in tenant-level membership tables';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_memberships_no_super_admin ON public.company_memberships;
CREATE TRIGGER trg_company_memberships_no_super_admin
BEFORE INSERT OR UPDATE OF user_id ON public.company_memberships
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_assignments();

DROP TRIGGER IF EXISTS trg_team_members_no_super_admin ON public.team_members;
CREATE TRIGGER trg_team_members_no_super_admin
BEFORE INSERT OR UPDATE OF user_id ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_assignments();

DROP TRIGGER IF EXISTS trg_ticket_members_no_super_admin ON public.ticket_members;
CREATE TRIGGER trg_ticket_members_no_super_admin
BEFORE INSERT OR UPDATE OF user_id ON public.ticket_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_assignments();

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_members ENABLE ROW LEVEL SECURITY;

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
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update
ON public.teams
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete
ON public.teams
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select
ON public.team_members
FOR SELECT
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert
ON public.team_members
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS team_members_update ON public.team_members;
CREATE POLICY team_members_update
ON public.team_members
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete
ON public.team_members
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
);

DROP POLICY IF EXISTS ticket_members_select ON public.ticket_members;
CREATE POLICY ticket_members_select
ON public.ticket_members
FOR SELECT
USING (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

DROP POLICY IF EXISTS ticket_members_insert ON public.ticket_members;
CREATE POLICY ticket_members_insert
ON public.ticket_members
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_company_role(
    company_id,
    ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

DROP POLICY IF EXISTS ticket_members_delete ON public.ticket_members;
CREATE POLICY ticket_members_delete
ON public.ticket_members
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
    AND (team_id IS NULL OR public.has_team_membership(team_id))
  )
);

DROP POLICY IF EXISTS tickets_insert ON public.tickets;
CREATE POLICY tickets_insert
ON public.tickets
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (
    public.has_company_role(
      company_id,
      ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
    )
    AND (team_id IS NULL OR public.has_team_membership(team_id))
  )
);

DROP POLICY IF EXISTS tickets_update ON public.tickets;
CREATE POLICY tickets_update
ON public.tickets
FOR UPDATE
USING (
  public.is_super_admin()
  OR (
    public.has_company_role(
      company_id,
      ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
    )
    AND (team_id IS NULL OR public.has_team_membership(team_id))
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    public.has_company_role(
      company_id,
      ARRAY['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
    )
    AND (team_id IS NULL OR public.has_team_membership(team_id))
  )
);

DROP POLICY IF EXISTS tickets_delete ON public.tickets;
CREATE POLICY tickets_delete
ON public.tickets
FOR DELETE
USING (
  public.is_super_admin()
  OR (
    public.has_company_role(company_id, ARRAY['COMPANY_ADMIN']::public.company_role[])
    AND (team_id IS NULL OR public.has_team_membership(team_id))
  )
);

GRANT EXECUTE ON FUNCTION public.is_non_super_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_membership(uuid) TO authenticated;
