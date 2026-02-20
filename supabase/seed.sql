DO $$
DECLARE
  user_ids uuid[];
  admin_id uuid;
  member_a uuid;
  member_b uuid;
  company_one uuid;
  company_two uuid;
  project_web uuid;
  project_mobile uuid;
BEGIN
  SELECT array_agg(id ORDER BY created_at) INTO user_ids FROM auth.users;

  IF user_ids IS NULL OR array_length(user_ids, 1) = 0 THEN
    RAISE NOTICE 'No auth users found. Seed skipped.';
    RETURN;
  END IF;

  admin_id := user_ids[1];
  member_a := COALESCE(user_ids[2], user_ids[1]);
  member_b := COALESCE(user_ids[3], user_ids[1]);

  INSERT INTO public.user_profiles (id, email, full_name)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(COALESCE(u.email, 'user'), '@', 1))
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();

  UPDATE public.user_profiles
  SET global_role = 'USER'
  WHERE id = ANY(user_ids);

  UPDATE public.user_profiles
  SET global_role = 'SUPER_ADMIN'
  WHERE id = admin_id;

  INSERT INTO public.companies (name, slug, created_by)
  VALUES ('Acme Operations', 'acme-operations', admin_id)
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        created_by = EXCLUDED.created_by,
        updated_at = now()
  RETURNING id INTO company_one;

  INSERT INTO public.companies (name, slug, created_by)
  VALUES ('Globex Digital', 'globex-digital', admin_id)
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        created_by = EXCLUDED.created_by,
        updated_at = now()
  RETURNING id INTO company_two;

  INSERT INTO public.company_memberships (company_id, user_id, role, is_active)
  VALUES
    (company_one, admin_id, 'COMPANY_ADMIN', true),
    (company_one, member_a, 'TICKET_CREATOR', true),
    (company_one, member_b, 'READER', true),
    (company_two, admin_id, 'COMPANY_ADMIN', true),
    (company_two, member_a, 'COMPANY_ADMIN', true)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = now();

  INSERT INTO public.projects (company_id, name, code, status, created_by)
  VALUES
    (company_one, 'Platform Revamp', 'PLAT', 'ACTIVE', admin_id),
    (company_two, 'Mobile Expansion', 'MOB', 'ACTIVE', admin_id)
  ON CONFLICT (company_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = now();

  SELECT id INTO project_web FROM public.projects WHERE company_id = company_one AND code = 'PLAT';
  SELECT id INTO project_mobile FROM public.projects WHERE company_id = company_two AND code = 'MOB';

  DELETE FROM public.tickets
  WHERE title IN (
    'Payment gateway timeout',
    'Design system accessibility gaps',
    'Database migration incident',
    'Mobile crash on startup'
  );

  INSERT INTO public.tickets (
    company_id,
    project_id,
    title,
    description,
    status,
    priority,
    estimated_hours,
    due_date,
    assigned_to,
    created_by
  )
  VALUES
    (
      company_one,
      project_web,
      'Payment gateway timeout',
      'Checkout webhook retries are timing out under load.',
      'ACTIVE',
      'URGENT',
      8,
      current_date + 1,
      member_a,
      admin_id
    ),
    (
      company_one,
      project_web,
      'Design system accessibility gaps',
      'Buttons and input labels are missing contrast and aria coverage.',
      'BACKLOG',
      'HIGH',
      12,
      current_date + 5,
      member_b,
      admin_id
    ),
    (
      company_one,
      project_web,
      'Database migration incident',
      'Unexpected lock contention after deployment.',
      'BLOCKED',
      'URGENT',
      6,
      current_date,
      admin_id,
      admin_id
    ),
    (
      company_two,
      project_mobile,
      'Mobile crash on startup',
      'Android release crashes on cold boot for selected devices.',
      'ACTIVE',
      'HIGH',
      10,
      current_date + 3,
      member_a,
      admin_id
    );

  DELETE FROM public.meetings
  WHERE title IN ('Daily Stand-up', 'Sprint Planning', 'Client Review');

  INSERT INTO public.meetings (
    company_id,
    title,
    starts_at,
    ends_at,
    participants,
    organizer_id
  )
  VALUES
    (
      company_one,
      'Daily Stand-up',
      date_trunc('day', now()) + interval '9 hours',
      date_trunc('day', now()) + interval '9 hours 30 minutes',
      to_jsonb(ARRAY[admin_id::text, member_a::text, member_b::text]),
      admin_id
    ),
    (
      company_one,
      'Sprint Planning',
      date_trunc('day', now()) + interval '14 hours',
      date_trunc('day', now()) + interval '15 hours',
      to_jsonb(ARRAY[admin_id::text, member_a::text]),
      admin_id
    ),
    (
      company_two,
      'Client Review',
      date_trunc('day', now()) + interval '16 hours',
      date_trunc('day', now()) + interval '17 hours',
      to_jsonb(ARRAY[admin_id::text, member_a::text]),
      admin_id
    );

  DELETE FROM public.time_logs WHERE notes like 'Seed:%';

  INSERT INTO public.time_logs (company_id, ticket_id, user_id, hours, log_date, notes)
  SELECT
    t.company_id,
    t.id,
    COALESCE(t.assigned_to, admin_id),
    LEAST(t.estimated_hours, 2),
    current_date,
    'Seed: initial effort log'
  FROM public.tickets t
  WHERE t.title IN (
    'Payment gateway timeout',
    'Design system accessibility gaps',
    'Database migration incident',
    'Mobile crash on startup'
  );
END $$;
