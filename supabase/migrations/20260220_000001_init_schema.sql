create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'global_role') THEN
    CREATE TYPE public.global_role AS ENUM ('SUPER_ADMIN', 'USER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role') THEN
    CREATE TYPE public.company_role AS ENUM ('COMPANY_ADMIN', 'TICKET_CREATOR', 'READER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE public.project_status AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE public.ticket_status AS ENUM ('BACKLOG', 'ACTIVE', 'BLOCKED', 'DONE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE public.ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  global_role public.global_role not null default 'USER',
  weekly_capacity_hours numeric(6,2) not null default 40,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role public.company_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  status public.project_status not null default 'ACTIVE',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status public.ticket_status not null default 'BACKLOG',
  priority public.ticket_priority not null default 'MEDIUM',
  estimated_hours numeric(6,2) not null default 0,
  due_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (estimated_hours >= 0)
);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  hours numeric(6,2) not null,
  log_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hours > 0)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  participants jsonb not null default '[]'::jsonb,
  organizer_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_memberships_updated_at on public.company_memberships;
create trigger trg_company_memberships_updated_at
before update on public.company_memberships
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

drop trigger if exists trg_time_logs_updated_at on public.time_logs;
create trigger trg_time_logs_updated_at
before update on public.time_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.has_company_role(
  target_company_id uuid,
  allowed_roles public.company_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role = any(allowed_roles)
  );
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_company_role(uuid, public.company_role[]) to authenticated;

create index if not exists idx_company_memberships_user_company
  on public.company_memberships (user_id, company_id, role)
  where is_active = true;

create index if not exists idx_projects_company_status
  on public.projects (company_id, status);

create index if not exists idx_tickets_company_status_priority
  on public.tickets (company_id, status, priority);

create index if not exists idx_tickets_assigned_to_status
  on public.tickets (assigned_to, status);

create index if not exists idx_time_logs_company_user_log_date
  on public.time_logs (company_id, user_id, log_date);

create index if not exists idx_meetings_company_starts_at
  on public.meetings (company_id, starts_at);

alter table public.user_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.tickets enable row level security;
alter table public.time_logs enable row level security;
alter table public.meetings enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select
on public.user_profiles
for select
using (
  id = auth.uid() or public.is_super_admin()
);

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert
on public.user_profiles
for insert
with check (
  id = auth.uid() or public.is_super_admin()
);

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update
on public.user_profiles
for update
using (
  id = auth.uid() or public.is_super_admin()
)
with check (
  id = auth.uid() or public.is_super_admin()
);

drop policy if exists companies_select on public.companies;
create policy companies_select
on public.companies
for select
using (
  public.is_super_admin()
  or public.has_company_role(
    id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists companies_insert on public.companies;
create policy companies_insert
on public.companies
for insert
with check (public.is_super_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update
on public.companies
for update
using (
  public.is_super_admin()
  or public.has_company_role(id, array['COMPANY_ADMIN']::public.company_role[])
)
with check (
  public.is_super_admin()
  or public.has_company_role(id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists company_memberships_select on public.company_memberships;
create policy company_memberships_select
on public.company_memberships
for select
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists company_memberships_insert on public.company_memberships;
create policy company_memberships_insert
on public.company_memberships
for insert
with check (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists company_memberships_update on public.company_memberships;
create policy company_memberships_update
on public.company_memberships
for update
using (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
)
with check (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects
for select
using (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert
on public.projects
for insert
with check (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists projects_update on public.projects;
create policy projects_update
on public.projects
for update
using (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
)
with check (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists tickets_select on public.tickets;
create policy tickets_select
on public.tickets
for select
using (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert
on public.tickets
for insert
with check (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

drop policy if exists tickets_update on public.tickets;
create policy tickets_update
on public.tickets
for update
using (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete
on public.tickets
for delete
using (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);

drop policy if exists time_logs_select on public.time_logs;
create policy time_logs_select
on public.time_logs
for select
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists time_logs_insert on public.time_logs;
create policy time_logs_insert
on public.time_logs
for insert
with check (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

drop policy if exists time_logs_update on public.time_logs;
create policy time_logs_update
on public.time_logs
for update
using (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN']::public.company_role[]
  )
)
with check (
  public.is_super_admin()
  or user_id = auth.uid()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN']::public.company_role[]
  )
);

drop policy if exists meetings_select on public.meetings;
create policy meetings_select
on public.meetings
for select
using (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR', 'READER']::public.company_role[]
  )
);

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
on public.meetings
for insert
with check (
  public.is_super_admin()
  or public.has_company_role(
    company_id,
    array['COMPANY_ADMIN', 'TICKET_CREATOR']::public.company_role[]
  )
);

drop policy if exists meetings_update on public.meetings;
create policy meetings_update
on public.meetings
for update
using (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
)
with check (
  public.is_super_admin()
  or public.has_company_role(company_id, array['COMPANY_ADMIN']::public.company_role[])
);
