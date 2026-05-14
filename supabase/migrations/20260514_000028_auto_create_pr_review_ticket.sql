-- Migration: Auto-create PR Review Ticket
-- Description: When a ticket's workflow_stage changes to 'PR_REVIEW', 
-- automatically create a new ticket for PR review in the same project with status BLOCKED

-- Create the trigger function with explicit search_path for security
CREATE OR REPLACE FUNCTION public.auto_create_pr_review_ticket()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
    pr_review_ticket_id UUID;
    original_ticket_number INTEGER;
    original_creator UUID;
BEGIN
    -- Only trigger when workflow_stage changes to PR_REVIEW
    IF NEW.workflow_stage = 'PR_REVIEW' AND 
       (OLD.workflow_stage IS NULL OR OLD.workflow_stage <> 'PR_REVIEW') THEN
        
        -- Get the original ticket number if exists
        SELECT ticket_number INTO original_ticket_number
        FROM public.tickets
        WHERE id = NEW.id;
        
        -- Use the ticket creator or current authenticated user
        original_creator := NEW.created_by;
        
        -- Create the PR review ticket
        INSERT INTO public.tickets (
            company_id,
            project_id,
            title,
            description,
            status,
            priority,
            estimated_hours,
            workflow_stage,
            team_id,
            board_id,
            requester_team_id,
            created_by,
            assigned_to,
            due_date,
            cross_team_alert
        ) VALUES (
            NEW.company_id,
            NEW.project_id,
            CASE 
                WHEN original_ticket_number IS NOT NULL 
                THEN 'Review PR #' || original_ticket_number || ': ' || NEW.title
                ELSE 'Review PR: ' || NEW.title
            END,
            COALESCE(NEW.description, 'PR Review required for ticket: ' || NEW.title || E'\n\nOriginal ticket ID: ' || NEW.id),
            'BLOCKED',  -- Status as requested: blocked/pending
            COALESCE(NEW.priority, 'MEDIUM'),
            COALESCE(NEW.estimated_hours, 0),
            'PR_REVIEW',  -- Same workflow stage
            NEW.team_id,
            NEW.board_id,
            NEW.requester_team_id,
            COALESCE(original_creator, auth.uid()),
            NULL,  -- Not auto-assigned, to be assigned by team lead
            NEW.due_date,
            NEW.cross_team_alert
        )
        RETURNING id INTO pr_review_ticket_id;
        
        -- Log the auto-creation in ticket history
        INSERT INTO public.ticket_history (
            ticket_id,
            company_id,
            actor_user_id,
            event_type,
            field_name,
            from_value,
            to_value,
            metadata
        ) VALUES (
            NEW.id,
            NEW.company_id,
            COALESCE(original_creator, auth.uid()),
            'AUTO_CREATED',
            'pr_review_ticket',
            NULL,
            pr_review_ticket_id::TEXT,
            jsonb_build_object(
                'source', 'auto_create_pr_review_ticket_trigger',
                'pr_review_ticket_id', pr_review_ticket_id,
                'original_ticket_id', NEW.id,
                'original_ticket_number', original_ticket_number
            )
        );
        
        -- Also create a history entry for the new PR review ticket
        INSERT INTO public.ticket_history (
            ticket_id,
            company_id,
            actor_user_id,
            event_type,
            field_name,
            from_value,
            to_value,
            metadata
        ) VALUES (
            pr_review_ticket_id,
            NEW.company_id,
            COALESCE(original_creator, auth.uid()),
            'AUTO_CREATED',
            'linked_original_ticket',
            NULL,
            NEW.id::TEXT,
            jsonb_build_object(
                'source', 'auto_create_pr_review_ticket_trigger',
                'auto_created_from_ticket_id', NEW.id,
                'auto_created_from_ticket_number', original_ticket_number,
                'reason', 'workflow_stage_changed_to_pr_review'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to the function
COMMENT ON FUNCTION public.auto_create_pr_review_ticket() IS 
    'Automatically creates a PR review ticket when workflow_stage changes to PR_REVIEW';

-- Drop existing trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_auto_create_pr_review_ticket ON public.tickets;

-- Create the trigger
CREATE TRIGGER trigger_auto_create_pr_review_ticket
    AFTER UPDATE OF workflow_stage ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_pr_review_ticket();

-- Add comment to the trigger
COMMENT ON TRIGGER trigger_auto_create_pr_review_ticket ON public.tickets IS 
    'Fires when workflow_stage is updated to create PR review ticket automatically';

-- Security: Revoke execute permissions to prevent direct RPC calls
-- The trigger will still work because it's executed by the database, not via RPC
REVOKE EXECUTE ON FUNCTION public.auto_create_pr_review_ticket() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_create_pr_review_ticket() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_pr_review_ticket() FROM authenticated;

-- Update function comment with security notes
COMMENT ON FUNCTION public.auto_create_pr_review_ticket() IS 
    'Automatically creates a PR review ticket when workflow_stage changes to PR_REVIEW. 
     Trigger-only function - not meant for direct RPC calls.
     Sets search_path = public, pg_temp for security.';
