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

const logTicketTimeSchema = z.object({
  ticketId: z.string().uuid(),
  elapsedSeconds: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 60 * 24),
  notes: z.string().max(2000).optional(),
  manualAddedSeconds: z.coerce
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24)
    .optional(),
  addedOneMinuteClicks: z.coerce.number().int().min(0).max(1440).optional(),
  addedTenMinuteClicks: z.coerce.number().int().min(0).max(1440).optional(),
});

interface TicketScope {
  id: string;
  company_id: string;
  team_id: string | null;
  requester_team_id: string | null;
  cross_team_alert: boolean;
  status: TicketStatus;
  estimated_hours: number;
  title: string;
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
  linked_ticket_id: string | null;
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
      ["COMPANY_ADMIN", "MANAGE_TEAM", "TICKET_CREATOR"].includes(membership.role)
  );
}

function isMissingLinkColumn(error: { message?: string } | null, columnName: string) {
  if (!error?.message) {
    return false;
  }

  const message = error.message.toLowerCase();
  const hasColumnName = message.includes(columnName.toLowerCase());
  const missingBySqlError = message.includes("does not exist");
  const missingBySchemaCache =
    message.includes("could not find") && message.includes("schema cache");

  return hasColumnName && (missingBySqlError || missingBySchemaCache);
}

function extractLinkedTicketNumber(description?: string | null) {
  if (!description) {
    return null;
  }

  const match = description.match(/#(\d{1,10})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function resolveLinkedTicketReference(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    companyId: string;
    description?: string | null;
    currentTicketId?: string;
  }
): Promise<{
  linkedTicketId: string;
  linkedTicketNumber: number;
  linkedTicketTitle: string;
} | null> {
  const referenceNumber = extractLinkedTicketNumber(input.description ?? null);
  if (!referenceNumber) {
    return null;
  }

  let query = supabase
    .from("tickets")
    .select("id, ticket_number, title")
    .eq("company_id", input.companyId)
    .eq("ticket_number", referenceNumber);

  if (input.currentTicketId) {
    query = query.neq("id", input.currentTicketId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isMissingLinkColumn(error, "ticket_number")) {
      throw new Error(
        "Ticket links are not available yet in this environment. Please apply the latest database migration."
      );
    }

    throw new Error(`Failed to resolve linked ticket reference: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    linkedTicketId: data.id,
    linkedTicketNumber: Number(data.ticket_number),
    linkedTicketTitle: data.title,
  };
}

async function resolveTicketLinkDetailsByIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  ticketIds: Array<string | null | undefined>
) {
  const normalizedIds = Array.from(new Set(ticketIds.filter(Boolean) as string[]));

  if (normalizedIds.length === 0) {
    return new Map<string, { ticket_number: number; title: string }>();
  }

  const { data, error } = await supabase
    .from("tickets")
    .select("id, ticket_number, title")
    .eq("company_id", companyId)
    .in("id", normalizedIds);

  if (error) {
    if (isMissingLinkColumn(error, "ticket_number")) {
      return new Map<string, { ticket_number: number; title: string }>();
    }

    throw new Error(`Failed to resolve linked ticket details: ${error.message}`);
  }

  return new Map<string, { ticket_number: number; title: string }>(
    (data ?? []).map((row) => [
      row.id,
      {
        ticket_number: Number(row.ticket_number),
        title: row.title,
      },
    ])
  );
}

function canDeleteInCompany(auth: Awaited<ReturnType<typeof getAuthContext>>, companyId: string) {
  if (auth.isSuperAdmin) {
    return true;
  }

  return auth.memberships.some(
    (membership) =>
      membership.company_id === companyId &&
      ["COMPANY_ADMIN", "MANAGE_TEAM"].includes(membership.role)
  );
}

async function isUserActiveTeamMember(
  companyId: string,
  teamId: string | null,
  userId: string
): Promise<boolean> {
  if (!teamId) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("company_id", companyId)
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

async function isUserActiveCompanyMember(companyId: string, userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

async function resolveTeamNames(teamIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(teamIds.filter(Boolean))) as string[];
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("teams").select("id, name").in("id", ids);

  return new Map<string, string>(
    ((data ?? []) as Array<{ id: string; name: string }>).map((item) => [item.id, item.name])
  );
}

async function resolveTicketScope(ticketId: string): Promise<TicketScope | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, company_id, team_id, requester_team_id, cross_team_alert, status, estimated_hours, title"
    )
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
  const { error } = await supabase.from("ticket_history").insert(entries);

  if (error) {
    console.error("Failed to append ticket history", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      entriesCount: entries.length,
    });
  }
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

  // Allow editing DONE tickets
  // if (ticket.status === "DONE") {
  //   return { error: "Done tickets are read-only" };
  // }

  const auth = await getAuthContext();
  if (!canManageInCompany(auth, ticket.company_id)) {
    return { error: "You do not have permission to update this ticket" };
  }

  const shouldClearCrossTeamAlert =
    ticket.cross_team_alert && parsed.data.status !== "BACKLOG" && ticket.team_id !== null;
  const doneAt = parsed.data.status === "DONE" ? new Date().toISOString() : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tickets")
    .update({
      status: parsed.data.status,
      done_at: doneAt,
      cross_team_alert: shouldClearCrossTeamAlert ? false : ticket.cross_team_alert,
    })
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
        cleared_cross_team_alert: shouldClearCrossTeamAlert,
        done_at: doneAt,
      },
    },
  ]);

  revalidatePath("/tickets");
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function logTicketTimeAction(input: {
  ticketId: string;
  elapsedSeconds: number;
  notes?: string;
  manualAddedSeconds?: number;
  addedOneMinuteClicks?: number;
  addedTenMinuteClicks?: number;
}): Promise<TicketMutationResult> {
  const parsed = logTicketTimeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid time log payload",
    };
  }

  const ticket = await resolveTicketScope(parsed.data.ticketId);
  if (!ticket) {
    return { error: "Ticket not found" };
  }

  const auth = await getAuthContext();

  const isCompanyMember = await isUserActiveCompanyMember(ticket.company_id, auth.user.id);
  if (!auth.isSuperAdmin && !isCompanyMember) {
    return { error: "Only active company members can log time on this ticket" };
  }

  if (!auth.isSuperAdmin && ticket.team_id) {
    const isTeamMember = await isUserActiveTeamMember(
      ticket.company_id,
      ticket.team_id,
      auth.user.id
    );
    if (!isTeamMember && !canManageInCompany(auth, ticket.company_id)) {
      return { error: "Only team members can log time on this ticket" };
    }
  }

  const supabase = await createSupabaseServerClient();
  const roundedHours = Number((parsed.data.elapsedSeconds / 3600).toFixed(2));
  const manualAddedSeconds = Math.max(0, parsed.data.manualAddedSeconds ?? 0);
  const addedOneMinuteClicks = Math.max(0, parsed.data.addedOneMinuteClicks ?? 0);
  const addedTenMinuteClicks = Math.max(0, parsed.data.addedTenMinuteClicks ?? 0);
  if (roundedHours <= 0) {
    return { error: "Logged hours must be greater than zero" };
  }

  const { error: insertError } = await supabase.from("time_logs").insert({
    company_id: ticket.company_id,
    ticket_id: ticket.id,
    user_id: auth.user.id,
    hours: roundedHours,
    log_date: new Date().toISOString().slice(0, 10),
    notes: parsed.data.notes?.trim() || null,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  const { data: loggedRows, error: loggedRowsError } = await supabase
    .from("time_logs")
    .select("hours")
    .eq("company_id", ticket.company_id)
    .eq("ticket_id", ticket.id);

  if (loggedRowsError) {
    return { error: loggedRowsError.message };
  }

  const totalLoggedHours = Number(
    (loggedRows ?? []).reduce((acc, row) => acc + Number(row.hours ?? 0), 0).toFixed(2)
  );
  const shouldSyncEstimated =
    ticket.estimated_hours <= 0 || ticket.estimated_hours < totalLoggedHours;

  if (shouldSyncEstimated) {
    const { error: updateEstimatedError } = await supabase
      .from("tickets")
      .update({
        estimated_hours: totalLoggedHours,
      })
      .eq("id", ticket.id)
      .eq("company_id", ticket.company_id);

    if (updateEstimatedError) {
      return { error: updateEstimatedError.message };
    }
  }

  const historyEntries: TicketHistoryInsert[] = [
    {
      ticket_id: ticket.id,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "time_logged",
      from_value: null,
      to_value: String(roundedHours),
      metadata: {
        source: "logTicketTimeAction",
        elapsed_seconds: parsed.data.elapsedSeconds,
        manual_added_seconds: manualAddedSeconds,
        added_one_minute_clicks: addedOneMinuteClicks,
        added_ten_minute_clicks: addedTenMinuteClicks,
        notes: parsed.data.notes?.trim() || null,
      },
    },
  ];

  if (manualAddedSeconds > 0) {
    historyEntries.push({
      ticket_id: ticket.id,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "time_adjustments",
      from_value: "0",
      to_value: Number((manualAddedSeconds / 3600).toFixed(2)).toString(),
      metadata: {
        source: "logTicketTimeAction",
        manual_added_seconds: manualAddedSeconds,
        added_one_minute_clicks: addedOneMinuteClicks,
        added_ten_minute_clicks: addedTenMinuteClicks,
      },
    });
  }

  if (shouldSyncEstimated) {
    historyEntries.push({
      ticket_id: ticket.id,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "estimated_hours",
      from_value: String(ticket.estimated_hours),
      to_value: String(totalLoggedHours),
      metadata: {
        source: "logTicketTimeAction",
        sync_reason: "time_logs_total",
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

  // Allow editing DONE tickets
  // if (ticket.status === "DONE") {
  //   return { error: "Done tickets are read-only" };
  // }

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
      "title, description, linked_ticket_id, project_id, workflow_stage, priority, estimated_hours, due_date, assigned_to, ticket_assignees(user_id)"
    )
    .eq("id", payload.ticketId)
    .eq("company_id", ticket.company_id)
    .single();

  if (previousSnapshotError || !previousSnapshot) {
    if (isMissingLinkColumn(previousSnapshotError, "linked_ticket_id")) {
      return {
        error:
          "Ticket links are not available yet in this environment. Please apply the latest database migration.",
      };
    }

    return { error: previousSnapshotError?.message ?? "Failed to read current ticket details" };
  }

  const snapshot = previousSnapshot as TicketSnapshot;

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

    if (ticket.team_id) {
      const { data: teamMemberRows, error: teamMemberError } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("company_id", ticket.company_id)
        .eq("team_id", ticket.team_id)
        .eq("is_active", true)
        .in("user_id", assignedToIds);

      if (teamMemberError) {
        return { error: teamMemberError.message };
      }

      if ((teamMemberRows ?? []).length !== assignedToIds.length) {
        return { error: "Some selected assignees do not belong to the ticket team" };
      }
    }
  }

  let linkedReference: {
    linkedTicketId: string;
    linkedTicketNumber: number;
    linkedTicketTitle: string;
  } | null = null;
  try {
    linkedReference = await resolveLinkedTicketReference(supabase, {
      companyId: ticket.company_id,
      description: payload.description ?? null,
      currentTicketId: payload.ticketId,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to resolve linked ticket reference",
    };
  }

  const nextLinkedTicketId = linkedReference?.linkedTicketId ?? null;

  const { error } = await supabase
    .from("tickets")
    .update({
      title: payload.title,
      description: payload.description || null,
      linked_ticket_id: nextLinkedTicketId,
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
    if (isMissingLinkColumn(error, "linked_ticket_id")) {
      return {
        error:
          "Ticket links are not available yet in this environment. Please apply the latest database migration.",
      };
    }

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

  const previousAssignees = Array.from(
    new Set((snapshot.ticket_assignees ?? []).map((item) => item.user_id))
  ).sort();
  const nextAssignees = [...assignedToIds].sort();
  const assigneesChanged =
    previousAssignees.length !== nextAssignees.length ||
    previousAssignees.some((value, index) => value !== nextAssignees[index]);

  const historyEntries: TicketHistoryInsert[] = [];
  const teamNames = await resolveTeamNames([ticket.team_id, ticket.requester_team_id]);
  const linkedTicketDetails = await resolveTicketLinkDetailsByIds(supabase, ticket.company_id, [
    snapshot.linked_ticket_id,
    nextLinkedTicketId,
  ]);

  if (snapshot.title !== payload.title) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "title",
      from_value: snapshot.title,
      to_value: payload.title,
      metadata: {
        source: "updateTicketDetailsAction",
        assigned_by_user_id: auth.user.id,
        assigned_by_user_name: auth.profile.full_name,
        assigned_by_team_id: ticket.requester_team_id ?? ticket.team_id,
        assigned_by_team_name:
          teamNames.get(ticket.requester_team_id ?? ticket.team_id ?? "") ?? null,
        target_team_id: ticket.team_id,
        target_team_name: ticket.team_id ? (teamNames.get(ticket.team_id) ?? null) : null,
      },
    });
  }

  if ((snapshot.description ?? null) !== (payload.description ?? null)) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "description",
      from_value: snapshot.description ?? null,
      to_value: payload.description ?? null,
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

  if ((snapshot.linked_ticket_id ?? null) !== nextLinkedTicketId) {
    const previousLinkedDetails = snapshot.linked_ticket_id
      ? (linkedTicketDetails.get(snapshot.linked_ticket_id) ?? null)
      : null;
    const nextLinkedDetails = nextLinkedTicketId
      ? (linkedTicketDetails.get(nextLinkedTicketId) ?? null)
      : null;

    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "linked_ticket_id",
      from_value: previousLinkedDetails ? String(previousLinkedDetails.ticket_number) : null,
      to_value: nextLinkedDetails ? String(nextLinkedDetails.ticket_number) : null,
      metadata: {
        source: "updateTicketDetailsAction",
        from_linked_ticket_title: previousLinkedDetails?.title ?? null,
        to_linked_ticket_title: nextLinkedDetails?.title ?? null,
      },
    });
  }

  if ((snapshot.project_id ?? null) !== (payload.projectId ?? null)) {
    historyEntries.push({
      ticket_id: payload.ticketId,
      company_id: ticket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "project_id",
      from_value: snapshot.project_id ?? null,
      to_value: payload.projectId ?? null,
      metadata: {
        source: "updateTicketDetailsAction",
      },
    });
  }

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
  if (!canDeleteInCompany(auth, ticket.company_id)) {
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
