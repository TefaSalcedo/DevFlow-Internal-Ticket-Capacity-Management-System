DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_workflow_stage') THEN
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'DESIGN';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'BUG';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'ADMIN';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'MEETING';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'NEW';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'ANALYSIS';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'RESEARCH';
    ALTER TYPE public.ticket_workflow_stage ADD VALUE IF NOT EXISTS 'SUPPORT';
  END IF;
END $$;
