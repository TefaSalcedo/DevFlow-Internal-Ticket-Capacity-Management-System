"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TicketStatus, TicketWorkflowStage } from "@/lib/types/domain";

const ticketStatusSchema = z.enum(["BACKLOG", "ACTIVE", "BLOCKED", "DONE"]);
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
  workflowStage: ticketWorkflowStageSchema,
  priority: ticketPrioritySchema,
  estimatedHours: z.coerce.number().min(0).max(200),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
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
  workflowStage: TicketWorkflowStage;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedHours: number;
  dueDate?: string;
  assignedTo?: string;
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

  const { error } = await supabase
    .from("tickets")
    .update({
      title: payload.title,
      description: payload.description || null,
      project_id: payload.projectId || null,
      workflow_stage: payload.workflowStage,
      priority: payload.priority,
      estimated_hours: payload.estimatedHours,
      due_date: payload.dueDate || null,
      assigned_to: payload.assignedTo || null,
    })
    .eq("id", payload.ticketId)
    .eq("company_id", ticket.company_id);

  if (error) {
    return { error: error.message };
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
