-- Migration: Add ticket_number and linked_ticket_id to tickets table
-- Purpose: Enable ticket linking via #number references in descriptions
-- Run this in Supabase SQL Editor if you see "Ticket links are not available yet" error

-- First, create a sequence for ticket numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Add ticket_number column with sequence default
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ticket_number BIGINT DEFAULT nextval('public.ticket_number_seq');

-- Add linked_ticket_id column to reference other tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS linked_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

-- Create unique index on ticket_number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_company_number 
ON public.tickets (company_id, ticket_number) 
WHERE ticket_number IS NOT NULL;

-- Create index for linked_ticket_id queries
CREATE INDEX IF NOT EXISTS idx_tickets_linked_ticket_id 
ON public.tickets (linked_ticket_id) 
WHERE linked_ticket_id IS NOT NULL;

-- Update existing tickets to have ticket numbers (only if they don't have one)
UPDATE public.tickets 
SET ticket_number = nextval('public.ticket_number_seq')
WHERE ticket_number IS NULL;

-- Add RLS policies for the new columns (they inherit from existing policies)
-- No additional policies needed since existing tickets policies cover these columns

-- Grant usage on sequence to authenticated users
GRANT USAGE ON SEQUENCE public.ticket_number_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.ticket_number_seq TO authenticated;
