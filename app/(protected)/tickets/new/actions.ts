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
  workflowStage: z.enum(["DEVELOPMENT", "DESIGN", "QA", "PR_REVIEW", "BUG", "ADMIN", "MEETING"]),
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
          ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
      );

  if (!canCreateInCompany) {
    return {
      error: "You do not have permission to create tickets in this company",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = parsed.data;
  const assignedToIds = Array.from(new Set(payload.assignedToIds));

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
  }

  const { data: createdTicket, error } = await supabase
    .from("tickets")
    .insert({
      company_id: payload.companyId,
      team_id: payload.teamId,
      board_id: payload.boardId,
      project_id: payload.projectId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status,
      workflow_stage: payload.workflowStage,
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

  revalidatePath("/tickets");
  revalidatePath("/tickets/all");
  revalidatePath("/tickets/mine");
  revalidatePath("/dashboard");
  redirect("/tickets");
}
