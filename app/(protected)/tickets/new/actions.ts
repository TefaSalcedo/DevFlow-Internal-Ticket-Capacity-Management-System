"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ticketSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(["BACKLOG", "ACTIVE", "BLOCKED", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  estimatedHours: z.coerce.number().min(0).max(200),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

export interface CreateTicketState {
  error?: string;
}

export async function createTicketAction(
  _previousState: CreateTicketState,
  formData: FormData
): Promise<CreateTicketState> {
  const parsed = ticketSchema.safeParse({
    companyId: formData.get("companyId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    projectId: formData.get("projectId") || undefined,
    status: formData.get("status"),
    priority: formData.get("priority"),
    estimatedHours: formData.get("estimatedHours") || 0,
    dueDate: formData.get("dueDate") || undefined,
    assignedTo: formData.get("assignedTo") || undefined,
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

  const { error } = await supabase.from("tickets").insert({
    company_id: payload.companyId,
    project_id: payload.projectId ?? null,
    title: payload.title,
    description: payload.description ?? null,
    status: payload.status,
    priority: payload.priority,
    estimated_hours: payload.estimatedHours,
    due_date: payload.dueDate || null,
    assigned_to: payload.assignedTo ?? null,
    created_by: auth.user.id,
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect("/tickets");
}
