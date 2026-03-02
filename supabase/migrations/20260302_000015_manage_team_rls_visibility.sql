-- Ensure MANAGE_TEAM can read team/project scope and work with project mutations.

-- Teams
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
  FOR SELECT
  USING (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role,
        'READER'::company_role
      ]
    )
  );

-- Team members
DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role
      ]
    )
  );

-- Company memberships (needed by workload/member listings)
DROP POLICY IF EXISTS company_memberships_select ON public.company_memberships;
CREATE POLICY company_memberships_select ON public.company_memberships
  FOR SELECT
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role
      ]
    )
  );

-- Projects
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
  FOR SELECT
  USING (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role,
        'READER'::company_role
      ]
    )
  );

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role
      ]
    )
  );

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE
  USING (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role
      ]
    )
  )
  WITH CHECK (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role
      ]
    )
  );

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
  FOR DELETE
  USING (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role
      ]
    )
  );

-- Boards (read is needed for embedded relations in ticket views)
DROP POLICY IF EXISTS boards_select ON public.boards;
CREATE POLICY boards_select ON public.boards
  FOR SELECT
  USING (
    is_super_admin()
    OR has_company_role(
      company_id,
      ARRAY[
        'COMPANY_ADMIN'::company_role,
        'MANAGE_TEAM'::company_role,
        'TICKET_CREATOR'::company_role,
        'READER'::company_role
      ]
    )
  );
