DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
      AND column_name = 'parent_ticket_id'
  ) THEN
    ALTER TABLE public.tickets
      ADD COLUMN parent_ticket_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_parent_ticket_id_fkey'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_parent_ticket_id_fkey
      FOREIGN KEY (parent_ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_parent_ticket_not_self'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_parent_ticket_not_self
      CHECK (parent_ticket_id IS NULL OR parent_ticket_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_parent_ticket_id
  ON public.tickets (parent_ticket_id);
