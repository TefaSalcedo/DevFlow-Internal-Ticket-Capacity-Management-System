"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TicketStatus, TicketWorkflowStage } from "@/lib/types/domain";

const ticketStatusSchema = z.enum(["BACKLOG", "ACTIVE", "BLOCKED", "BUG", "DESIGN", "DONE"]);
const ticketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const ticketWorkflowStageSchema = z.enum(["DEVELOPMENT", "QA", "PR_REVIEW"]);

const updateTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: ticketStatusSchema,
});

const updateTicketDetailsSchema = z.object({
  ticketId: z.string().uuid(),
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  workflowStage: ticketWorkflowStageSchema,
  priority: ticketPrioritySchema,
  estimatedHours: z.coerce.number().min(0).max(200),
  dueDate: z.string().optional(),
  assignedToIds: z.array(z.string().uuid()).max(10),
});

const deleteTicketSchema = z.object({
  ticketId: z.string().uuid(),
});

interface TicketScope {
  id: string;
  company_id: string;
  status: TicketStatus;
}

interface TicketMutationResult {
  error?: string;
  success?: boolean;
}

function canManageInCompany(auth: Awaited<ReturnType<typeof getAuthContext>>, companyId: string) {
  if (auth.isSuperAdmin) {
    return true;
  }

  return auth.memberships.some(
    (membership) =>
      membership.company_id === companyId &&
      ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
  );
}

async function resolveTicketScope(ticketId: string): Promise<TicketScope | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, company_id, status")
    .eq("id", ticketId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TicketScope;
}

export async function updateTicketStatusAction(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<TicketMutationResult> {
  const parsed = updateTicketStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid ticket status payload",
    };
  }

  const ticket = await resolveTicketScope(parsed.data.ticketId);
  if (!ticket) {
    return { error: "Ticket not found" };
  }

  if (ticket.status === "DONE") {
    return { error: "Done tickets are read-only" };
  }

  const auth = await getAuthContext();
  if (!canManageInCompany(auth, ticket.company_id)) {
    return { error: "You do not have permission to update this ticket" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tickets")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.ticketId)
    .eq("company_id", ticket.company_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateTicketDetailsAction(input: {
  ticketId: string;
  title: string;
  description?: string;
  projectId?: string;
  teamId?: string;
  workflowStage: TicketWorkflowStage;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedHours: number;
  dueDate?: string;
  assignedToIds: string[];
}): Promise<TicketMutationResult> {
  const parsed = updateTicketDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid ticket update payload",
    };
  }

  const ticket = await resolveTicketScope(parsed.data.ticketId);
  if (!ticket) {
    return { error: "Ticket not found" };
  }

  if (ticket.status === "DONE") {
    return { error: "Done tickets are read-only" };
  }

  const auth = await getAuthContext();
  if (!canManageInCompany(auth, ticket.company_id)) {
    return { error: "You do not have permission to update this ticket" };
  }

  const supabase = await createSupabaseServerClient();
  const payload = parsed.data;
  const assignedToIds = Array.from(new Set(payload.assignedToIds));

  if (payload.teamId) {
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", payload.teamId)
      .eq("company_id", ticket.company_id)
      .single();

    if (teamError || !teamData) {
      return {
        error: "Selected team is invalid for this company",
      };
    }

    if (!auth.isSuperAdmin) {
      const { data: memberData, error: memberError } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", payload.teamId)
        .eq("company_id", ticket.company_id)
        .eq("user_id", auth.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (memberError) {
        return {
          error: memberError.message,
        };
      }

      if (!memberData) {
        return {
          error: "You can only assign team tickets for teams where you are a member",
        };
      }
    }
  }

  if (assignedToIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("company_memberships")
      .select("user_id, user_profiles!inner(global_role)")
      .eq("company_id", ticket.company_id)
      .eq("is_active", true)
      .neq("user_profiles.global_role", "SUPER_ADMIN")
      .in("user_id", assignedToIds);

    if (membershipError) {
      return { error: membershipError.message };
    }

    if ((membershipRows ?? []).length !== assignedToIds.length) {
      return { error: "Some selected assignees are invalid, inactive, or SUPER_ADMIN users" };
    }
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      title: payload.title,
      description: payload.description || null,
      project_id: payload.projectId || null,
      team_id: payload.teamId || null,
      workflow_stage: payload.workflowStage,
      priority: payload.priority,
      estimated_hours: payload.estimatedHours,
      due_date: payload.dueDate || null,
      assigned_to: assignedToIds[0] ?? null,
    })
    .eq("id", payload.ticketId)
    .eq("company_id", ticket.company_id);

  if (error) {
    return { error: error.message };
  }

  const { error: clearAssignmentError } = await supabase
    .from("ticket_members")
    .delete()
    .eq("ticket_id", payload.ticketId)
    .eq("company_id", ticket.company_id);

  if (clearAssignmentError) {
    return { error: clearAssignmentError.message };
  }

  if (assignedToIds.length > 0) {
    const { error: assignmentError } = await supabase.from("ticket_members").insert(
      assignedToIds.map((userId) => ({
        ticket_id: payload.ticketId,
        company_id: ticket.company_id,
        user_id: userId,
        assigned_by: auth.user.id,
      }))
    );

    if (assignmentError) {
      return { error: assignmentError.message };
    }

    await supabase
      .from("ticket_assignees")
      .delete()
      .eq("ticket_id", payload.ticketId)
      .eq("company_id", ticket.company_id);

    await supabase.from("ticket_assignees").insert(
      assignedToIds.map((userId) => ({
        ticket_id: payload.ticketId,
        company_id: ticket.company_id,
        user_id: userId,
        assigned_by: auth.user.id,
      }))
    );
  } else {
    await supabase
      .from("ticket_assignees")
      .delete()
      .eq("ticket_id", payload.ticketId)
      .eq("company_id", ticket.company_id);
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteTicketAction(input: {
  ticketId: string;
}): Promise<TicketMutationResult> {
  const parsed = deleteTicketSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid ticket delete payload",
    };
  }

  const ticket = await resolveTicketScope(parsed.data.ticketId);
  if (!ticket) {
    return { error: "Ticket not found" };
  }

  if (ticket.status === "DONE") {
    return { error: "Done tickets cannot be deleted" };
  }

  const auth = await getAuthContext();
  if (!canManageInCompany(auth, ticket.company_id)) {
    return { error: "You do not have permission to delete this ticket" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", parsed.data.ticketId)
    .eq("company_id", ticket.company_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");

  return { success: true };
}
