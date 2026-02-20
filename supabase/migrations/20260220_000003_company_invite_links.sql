create table if not exists public.company_invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.company_role not null default 'READER',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_company_invite_links_company_active
  on public.company_invite_links (company_id, is_active);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_token text;
  invite_company_id uuid;
  invite_role public.company_role;
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

  invite_token := nullif(trim(coalesce(new.raw_user_meta_data ->> 'invite_token', '')), '');

  if invite_token is not null then
    select cil.company_id, cil.role
      into invite_company_id, invite_role
    from public.company_invite_links cil
    where cil.token = invite_token
      and cil.is_active = true
      and (cil.expires_at is null or cil.expires_at > now())
    limit 1;

    if invite_company_id is not null then
      insert into public.company_memberships (company_id, user_id, role, is_active)
      values (invite_company_id, new.id, invite_role, true)
      on conflict (company_id, user_id) do update
        set role = excluded.role,
            is_active = true,
            updated_at = now();
    end if;
  end if;

  return new;
end;
$$;
