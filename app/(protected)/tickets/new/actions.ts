"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ticketSchema = z.object({
  companyId: z.string().uuid(),
  teamId: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(["BACKLOG", "ACTIVE", "BLOCKED", "DONE"]),
  workflowStage: z.enum([
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
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  estimatedHours: z.coerce.number().min(0).max(200),
  dueDate: z.string().optional(),
  assignedToIds: z.array(z.string().uuid()).max(10),
});

export interface CreateTicketState {
  error?: string;
}

function extractAssignedToIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("assignedToIds")
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
}

export async function createTicketAction(
  _previousState: CreateTicketState,
  formData: FormData
): Promise<CreateTicketState> {
  const parsed = ticketSchema.safeParse({
    companyId: formData.get("companyId"),
    teamId: formData.get("teamId"),
    boardId: formData.get("boardId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    projectId: formData.get("projectId") || undefined,
    status: formData.get("status"),
    workflowStage: formData.get("workflowStage"),
    priority: formData.get("priority"),
    estimatedHours: formData.get("estimatedHours") || 0,
    dueDate: formData.get("dueDate") || undefined,
    assignedToIds: extractAssignedToIds(formData),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid ticket payload",
    };
  }

  const auth = await getAuthContext();

  const canCreateInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) =>
          membership.company_id === parsed.data.companyId &&
          ["COMPANY_ADMIN", "MANAGE_TEAM", "TICKET_CREATOR"].includes(membership.role)
      );

  if (!canCreateInCompany) {
    return {
      error: "You do not have permission to create tickets in this company",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = parsed.data;
  const assignedToIds = Array.from(new Set(payload.assignedToIds));

  const { data: requesterTeamRows, error: requesterTeamError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("company_id", payload.companyId)
    .eq("user_id", auth.user.id)
    .eq("is_active", true);

  if (requesterTeamError) {
    return {
      error: requesterTeamError.message,
    };
  }

  const requesterTeamIds = Array.from(
    new Set((requesterTeamRows ?? []).map((row) => String(row.team_id ?? "")).filter(Boolean))
  );
  const isCrossTeamTicket = !requesterTeamIds.includes(payload.teamId);
  const requesterTeamId = isCrossTeamTicket ? (requesterTeamIds[0] ?? null) : payload.teamId;

  const effectiveStatus = isCrossTeamTicket ? "BACKLOG" : payload.status;
  const effectiveWorkflowStage = isCrossTeamTicket ? "NEW" : payload.workflowStage;

  const { data: boardRow, error: boardError } = await supabase
    .from("boards")
    .select("id, company_id, team_id")
    .eq("id", payload.boardId)
    .single();

  if (boardError || !boardRow) {
    return {
      error: "Selected board was not found",
    };
  }

  if (boardRow.company_id !== payload.companyId || boardRow.team_id !== payload.teamId) {
    return {
      error: "Selected board does not belong to the selected company/team",
    };
  }

  if (assignedToIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", payload.companyId)
      .eq("is_active", true)
      .in("user_id", assignedToIds);

    if (membershipError) {
      return {
        error: membershipError.message,
      };
    }

    if ((membershipRows ?? []).length !== assignedToIds.length) {
      return {
        error: "Some selected assignees are not active members of this company",
      };
    }

    const { data: teamMemberRows, error: teamMemberError } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("company_id", payload.companyId)
      .eq("team_id", payload.teamId)
      .eq("is_active", true)
      .in("user_id", assignedToIds);

    if (teamMemberError) {
      return {
        error: teamMemberError.message,
      };
    }

    if ((teamMemberRows ?? []).length !== assignedToIds.length) {
      return {
        error: "Some selected assignees do not belong to the selected team",
      };
    }
  }

  const teamLookupIds = Array.from(
    new Set([payload.teamId, ...(requesterTeamId ? [requesterTeamId] : [])])
  );
  const { data: teamLookupRows } =
    teamLookupIds.length > 0
      ? await supabase.from("teams").select("id, name").in("id", teamLookupIds)
      : { data: [] as Array<{ id: string; name: string }> };

  const teamNameMap = new Map<string, string>(
    ((teamLookupRows ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])
  );

  const { data: createdTicket, error } = await supabase
    .from("tickets")
    .insert({
      company_id: payload.companyId,
      team_id: payload.teamId,
      board_id: payload.boardId,
      requester_team_id: requesterTeamId,
      cross_team_alert: isCrossTeamTicket,
      project_id: payload.projectId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: effectiveStatus,
      workflow_stage: effectiveWorkflowStage,
      priority: payload.priority,
      estimated_hours: payload.estimatedHours,
      due_date: payload.dueDate || null,
      assigned_to: assignedToIds[0] ?? null,
      created_by: auth.user.id,
    })
    .select("id, company_id")
    .single();

  if (error) {
    return {
      error: error.message,
    };
  }

  if (assignedToIds.length > 0) {
    const { error: assignmentError } = await supabase.from("ticket_assignees").insert(
      assignedToIds.map((userId) => ({
        ticket_id: createdTicket.id,
        company_id: createdTicket.company_id,
        user_id: userId,
        assigned_by: auth.user.id,
      }))
    );

    if (assignmentError) {
      await supabase
        .from("tickets")
        .delete()
        .eq("id", createdTicket.id)
        .eq("company_id", createdTicket.company_id);

      return {
        error: assignmentError.message,
      };
    }
  }

  await supabase.from("ticket_history").insert([
    {
      ticket_id: createdTicket.id,
      company_id: createdTicket.company_id,
      actor_user_id: auth.user.id,
      event_type: "CREATED",
      field_name: null,
      from_value: null,
      to_value: payload.title,
      metadata: {
        status: effectiveStatus,
        workflow_stage: effectiveWorkflowStage,
        priority: payload.priority,
        due_date: payload.dueDate || null,
        requester_team_id: requesterTeamId,
        requester_team_name: requesterTeamId ? (teamNameMap.get(requesterTeamId) ?? null) : null,
        target_team_id: payload.teamId,
        target_team_name: teamNameMap.get(payload.teamId) ?? null,
        cross_team_alert: isCrossTeamTicket,
      },
    },
    {
      ticket_id: createdTicket.id,
      company_id: createdTicket.company_id,
      actor_user_id: auth.user.id,
      event_type: "FIELD_CHANGED",
      field_name: "assignees",
      from_value: null,
      to_value: assignedToIds.join(", "),
      metadata: {
        source: "createTicketAction",
        assigned_by_user_id: auth.user.id,
        assigned_by_user_name: auth.profile.full_name,
        assigned_by_team_id: requesterTeamId,
        assigned_by_team_name: requesterTeamId ? (teamNameMap.get(requesterTeamId) ?? null) : null,
        target_team_id: payload.teamId,
        target_team_name: teamNameMap.get(payload.teamId) ?? null,
      },
    },
  ]);

  revalidatePath("/tickets");
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
  revalidatePath("/dashboard");
  redirect("/tickets");
}
