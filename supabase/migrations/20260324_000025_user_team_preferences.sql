create table if not exists public.user_team_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_user_team_preferences_company_user
  on public.user_team_preferences (company_id, user_id);

alter table public.user_team_preferences enable row level security;

drop trigger if exists trg_user_team_preferences_updated_at on public.user_team_preferences;
create trigger trg_user_team_preferences_updated_at
before update on public.user_team_preferences
for each row execute function public.set_updated_at();

drop policy if exists user_team_preferences_select on public.user_team_preferences;
create policy user_team_preferences_select
on public.user_team_preferences
for select
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'MANAGE_TEAM', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists user_team_preferences_insert on public.user_team_preferences;
create policy user_team_preferences_insert
on public.user_team_preferences
for insert
with check (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
);

drop policy if exists user_team_preferences_update on public.user_team_preferences;
create policy user_team_preferences_update
on public.user_team_preferences
for update
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
)
with check (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'MANAGE_TEAM']::public.company_role[]
  )
);

drop policy if exists user_team_preferences_delete on public.user_team_preferences;
create policy user_team_preferences_delete
on public.user_team_preferences
for delete
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN']::public.company_role[]
  )
);
