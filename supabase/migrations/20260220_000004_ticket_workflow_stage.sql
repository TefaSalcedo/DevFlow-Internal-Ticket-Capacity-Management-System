DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_workflow_stage') THEN
    CREATE TYPE public.ticket_workflow_stage AS ENUM ('DEVELOPMENT', 'QA', 'PR_REVIEW');
  END IF;
END $$;

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS workflow_stage public.ticket_workflow_stage NOT NULL DEFAULT 'DEVELOPMENT';

CREATE INDEX IF NOT EXISTS idx_tickets_company_workflow_stage
  ON public.tickets (company_id, workflow_stage);
