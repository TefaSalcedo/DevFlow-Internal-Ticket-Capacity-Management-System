create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists idx_companies_created_by on public.companies (created_by);
create index if not exists idx_projects_created_by on public.projects (created_by);
create index if not exists idx_tickets_created_by on public.tickets (created_by);
create index if not exists idx_tickets_project_id on public.tickets (project_id);
create index if not exists idx_time_logs_ticket_id on public.time_logs (ticket_id);
create index if not exists idx_time_logs_user_id on public.time_logs (user_id);
create index if not exists idx_meetings_organizer_id on public.meetings (organizer_id);
