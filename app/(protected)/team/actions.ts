"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createTeamSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

const updateTeamSchema = z.object({
  companyId: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});

const deleteTeamSchema = z.object({
  companyId: z.string().uuid(),
  teamId: z.string().uuid(),
});

const assignTeamMemberSchema = z.object({
  companyId: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

function canManageTeams(auth: Awaited<ReturnType<typeof getAuthContext>>, companyId: string) {
  if (auth.isSuperAdmin) {
    return true;
  }

  return auth.memberships.some(
    (membership) => membership.company_id === companyId && membership.role === "COMPANY_ADMIN"
  );
}

export async function createTeamAction(formData: FormData) {
  const parsed = createTeamSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid team payload");
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    throw new Error("You do not have permission to create teams");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("teams").insert({
    company_id: parsed.data.companyId,
    name: parsed.data.name,
    created_by: auth.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}

export async function updateTeamAction(formData: FormData) {
  const parsed = updateTeamSchema.safeParse({
    companyId: formData.get("companyId"),
    teamId: formData.get("teamId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid team update payload");
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    throw new Error("You do not have permission to update teams");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.teamId)
    .eq("company_id", parsed.data.companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}

export async function deleteTeamAction(formData: FormData) {
  const parsed = deleteTeamSchema.safeParse({
    companyId: formData.get("companyId"),
    teamId: formData.get("teamId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid team delete payload");
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    throw new Error("You do not have permission to delete teams");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", parsed.data.teamId)
    .eq("company_id", parsed.data.companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}

export async function assignTeamMemberAction(formData: FormData) {
  const parsed = assignTeamMemberSchema.safeParse({
    companyId: formData.get("companyId"),
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid team member payload");
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    throw new Error("You do not have permission to assign team members");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("team_members").upsert(
    {
      company_id: parsed.data.companyId,
      team_id: parsed.data.teamId,
      user_id: parsed.data.userId,
      is_active: true,
      assigned_by: auth.user.id,
    },
    { onConflict: "team_id,user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}

export async function removeTeamMemberAction(formData: FormData) {
  const parsed = assignTeamMemberSchema.safeParse({
    companyId: formData.get("companyId"),
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid team member payload");
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    throw new Error("You do not have permission to remove team members");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      is_active: false,
      assigned_by: auth.user.id,
    })
    .eq("company_id", parsed.data.companyId)
    .eq("team_id", parsed.data.teamId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}
