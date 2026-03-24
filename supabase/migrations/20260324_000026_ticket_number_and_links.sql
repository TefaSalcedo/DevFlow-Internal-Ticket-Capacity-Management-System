create sequence if not exists public.tickets_ticket_number_seq;

alter table public.tickets
  add column if not exists ticket_number bigint;

alter table public.tickets
  alter column ticket_number set default nextval('public.tickets_ticket_number_seq');

update public.tickets
set ticket_number = nextval('public.tickets_ticket_number_seq')
where ticket_number is null;

alter table public.tickets
  alter column ticket_number set not null;

create unique index if not exists idx_tickets_ticket_number_unique
  on public.tickets (ticket_number);

alter table public.tickets
  add column if not exists linked_ticket_id uuid references public.tickets(id) on delete set null;

create index if not exists idx_tickets_linked_ticket_id
  on public.tickets (linked_ticket_id);
