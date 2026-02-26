"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TicketStatus, TicketWorkflowStage } from "@/lib/types/domain";

const ticketStatusSchema = z.enum(["BACKLOG", "ACTIVE", "BLOCKED", "DONE"]);
const ticketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const ticketWorkflowStageSchema = z.enum([
  "NEW",
  "ANALYSIS",
  "RESEARCH",
  "SUPPORT",
  "DEVELOPMENT",
  "DESIGN",
  "QA",
  "PR_REVIEW",
  "BUG",
  "ADMIN",
  "MEETING",
]);

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

interface TicketHistoryInsert {
  ticket_id: string;
  company_id: string;
  actor_user_id: string;
  event_type: string;
  field_name: string | null;
  from_value: string | null;
  to_value: string | null;
  metadata: Record<string, unknown>;
}

interface TicketSnapshot {
  title: string;
  description: string | null;
  project_id: string | null;
  workflow_stage: TicketWorkflowStage;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimated_hours: number;
  due_date: string | null;
  assigned_to: string | null;
  ticket_assignees: Array<{ user_id: string }> | null;
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

async function appendTicketHistory(entries: TicketHistoryInsert[]) {
  if (entries.length === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("ticket_history").insert(entries);
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

  await appendTicketHistory([
    {
      ticket_id: parsed.data.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "status",
      from_value: ticket.status,
      to_value: parsed.data.status,
      metadata: {
        source: "updateTicketStatusAction",
      },
    },
  ]);

  revalidatePath("/tickets");
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
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

  const { data: previousSnapshot, error: previousSnapshotError } = await supabase
    .from("tickets")
    .select(
      "title, description, project_id, workflow_stage, priority, estimated_hours, due_date, assigned_to, ticket_assignees(user_id)"
    )
    .eq("id", payload.ticketId)
    .eq("company_id", ticket.company_id)
    .single();

  if (previousSnapshotError || !previousSnapshot) {
    return { error: previousSnapshotError?.message ?? "Failed to read current ticket details" };
  }

  if (assignedToIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", ticket.company_id)
      .eq("is_active", true)
      .in("user_id", assignedToIds);

    if (membershipError) {
      return { error: membershipError.message };
    }

    if ((membershipRows ?? []).length !== assignedToIds.length) {
      return { error: "Some selected assignees are not active members of this company" };
    }
  }

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
      assigned_to: assignedToIds[0] ?? null,
    })
    .eq("id", payload.ticketId)
    .eq("company_id", ticket.company_id);

  if (error) {
    return { error: error.message };
  }

  const { error: clearAssignmentError } = await supabase
    .from("ticket_assignees")
    .delete()
    .eq("ticket_id", payload.ticketId)
    .eq("company_id", ticket.company_id);

  if (clearAssignmentError) {
    return { error: clearAssignmentError.message };
  }

  if (assignedToIds.length > 0) {
    const { error: assignmentError } = await supabase.from("ticket_assignees").insert(
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
  }

  const snapshot = previousSnapshot as TicketSnapshot;
  const previousAssignees = Array.from(
    new Set((snapshot.ticket_assignees ?? []).map((item) => item.user_id))
  ).sort();
  const nextAssignees = [...assignedToIds].sort();
  const assigneesChanged =
    previousAssignees.length !== nextAssignees.length ||
    previousAssignees.some((value, index) => value !== nextAssignees[index]);

  const historyEntries: TicketHistoryInsert[] = [];

  if (snapshot.workflow_stage !== payload.workflowStage) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "workflow_stage",
      from_value: snapshot.workflow_stage,
      to_value: payload.workflowStage,
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

  if (snapshot.priority !== payload.priority) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "priority",
      from_value: snapshot.priority,
      to_value: payload.priority,
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

  const nextDueDate = payload.dueDate || null;
  if ((snapshot.due_date ?? null) !== nextDueDate) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "due_date",
      from_value: snapshot.due_date,
      to_value: nextDueDate,
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

  if (assigneesChanged) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "assignees",
      from_value: previousAssignees.join(", "),
      to_value: nextAssignees.join(", "),
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

  await appendTicketHistory(historyEntries);

  revalidatePath("/tickets");
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
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
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
  revalidatePath("/dashboard");

  return { success: true };
}
