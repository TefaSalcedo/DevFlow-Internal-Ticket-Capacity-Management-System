"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON ?? "";

async function sendMembershipDisabledEmail(
  userId: string,
  companyName: string,
  disabledByName: string,
  userAccessToken: string
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-membership-disabled-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ userId, companyName, disabledByName }),
    });
  } catch {
    // Email is best-effort — don't block the main action if it fails
  }
}

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
  userId: z.string().uuid().nullable(),
});

const disableMembershipSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
});

const transferAdminSchema = z.object({
  companyId: z.string().uuid(),
  newAdminUserId: z.string().uuid(),
});

const transferTeamLeadSchema = z.object({
  companyId: z.string().uuid(),
  newTeamLeadUserId: z.string().uuid(),
});

function canManageTeams(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  companyId: string
): boolean {
  const membership = auth.memberships.find((m) => m.company_id === companyId);
  return auth.isSuperAdmin || membership?.role === "COMPANY_ADMIN";
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

  // Check if user has MANAGE_TEAM or COMPANY_ADMIN role
  const membership = auth.memberships.find((m) => m.company_id === parsed.data.companyId);

  if (!membership && !auth.isSuperAdmin) {
    throw new Error("You do not have permission to update teams");
  }

  const isCompanyAdmin = membership?.role === "COMPANY_ADMIN";
  const isManageTeam = membership?.role === "MANAGE_TEAM";

  if (!isCompanyAdmin && !isManageTeam && !auth.isSuperAdmin) {
    throw new Error("You do not have permission to update teams");
  }

  const supabase = await createSupabaseServerClient();

  // If MANAGE_TEAM, verify they are a member of this specific team
  if (isManageTeam && !auth.isSuperAdmin) {
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", auth.user.id)
      .eq("company_id", parsed.data.companyId)
      .eq("is_active", true)
      .single();

    if (!teamMember) {
      throw new Error("You can only edit your own team");
    }
  }

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

  if (!parsed.data.userId) {
    throw new Error("Please select a user to assign to the team");
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

const moveTeamMemberSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  fromTeamId: z.string().uuid(),
  toTeamId: z.string().uuid(),
});

export async function moveTeamMemberAction(formData: FormData) {
  const parsed = moveTeamMemberSchema.safeParse({
    companyId: formData.get("companyId"),
    userId: formData.get("userId"),
    fromTeamId: formData.get("fromTeamId"),
    toTeamId: formData.get("toTeamId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid move payload");
  }

  const auth = await getAuthContext();

  // Only COMPANY_ADMIN can move members between teams
  const isAdmin =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (m) => m.company_id === parsed.data.companyId && m.role === "COMPANY_ADMIN"
    );

  if (!isAdmin) {
    throw new Error("Only COMPANY_ADMIN can move members between teams");
  }

  const supabase = await createSupabaseServerClient();

  // Remove from source team
  const { error: removeError } = await supabase
    .from("team_members")
    .update({ is_active: false, assigned_by: auth.user.id })
    .eq("company_id", parsed.data.companyId)
    .eq("team_id", parsed.data.fromTeamId)
    .eq("user_id", parsed.data.userId);

  if (removeError) {
    throw new Error(`Failed to remove from team: ${removeError.message}`);
  }

  // Add to destination team
  const { error: addError } = await supabase.from("team_members").upsert(
    {
      company_id: parsed.data.companyId,
      team_id: parsed.data.toTeamId,
      user_id: parsed.data.userId,
      is_active: true,
      assigned_by: auth.user.id,
    },
    { onConflict: "team_id,user_id" }
  );

  if (addError) {
    throw new Error(`Failed to add to team: ${addError.message}`);
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
}

export interface DisableMembershipResult {
  error?: string;
  success?: string;
  requiresTransfer?: boolean;
}

export async function disableCompanyMembershipAction(
  _previousState: DisableMembershipResult,
  formData: FormData
): Promise<DisableMembershipResult> {
  const parsed = disableMembershipSchema.safeParse({
    companyId: formData.get("companyId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const auth = await getAuthContext();
  if (!canManageTeams(auth, parsed.data.companyId)) {
    return { error: "You do not have permission to disable members" };
  }

  // Prevent self-deactivation without transfer
  if (parsed.data.userId === auth.user.id) {
    return {
      error:
        "Para desvincularte, primero selecciona a quién deseas pasarle el rol de COMPANY_ADMIN",
      requiresTransfer: true,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Deactivate company membership
  const { error: membershipError } = await supabase
    .from("company_memberships")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", parsed.data.userId);

  if (membershipError) {
    return { error: membershipError.message };
  }

  // Also deactivate all team memberships for this user in this company
  await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", parsed.data.userId);

  // Unassign all tickets from this user and add history
  const { data: ticketsToUnassign } = await supabase
    .from("tickets")
    .select("id, title")
    .eq("company_id", parsed.data.companyId)
    .eq("assigned_to", parsed.data.userId);

  if (ticketsToUnassign && ticketsToUnassign.length > 0) {
    // Unassign tickets
    await supabase
      .from("tickets")
      .update({ assigned_to: null })
      .eq("company_id", parsed.data.companyId)
      .eq("assigned_to", parsed.data.userId);

    // Add history for each unassigned ticket
    const now = new Date().toISOString();
    const historyEntries = ticketsToUnassign.map((ticket) => ({
      ticket_id: ticket.id,
      company_id: parsed.data.companyId,
      actor_user_id: auth.user.id,
      event_type: "ASSIGNMENT_CHANGE",
      field_name: "assigned_to",
      from_value: parsed.data.userId,
      to_value: null,
      metadata: {
        reason: "user_disabled",
        user_name: auth.profile.full_name,
        disabled_user_id: parsed.data.userId,
        timestamp: now,
      },
    }));

    await supabase.from("ticket_history").insert(historyEntries);
  }

  // Fetch company name for the email
  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", parsed.data.companyId)
    .single();

  // Send farewell email (best-effort)
  const { data: sessionData } = await supabase.auth.getSession();
  if (companyRow?.name && sessionData?.session?.access_token) {
    await sendMembershipDisabledEmail(
      parsed.data.userId,
      companyRow.name,
      auth.profile.full_name ?? "an admin",
      sessionData.session.access_token
    );
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
  return { success: "User membership deactivated successfully" };
}

export async function transferAdminAndLeaveAction(
  _previousState: DisableMembershipResult,
  formData: FormData
): Promise<DisableMembershipResult> {
  const parsed = transferAdminSchema.safeParse({
    companyId: formData.get("companyId"),
    newAdminUserId: formData.get("newAdminUserId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const auth = await getAuthContext();

  // Verify current user is COMPANY_ADMIN
  const isAdmin = auth.memberships.some(
    (m) => m.company_id === parsed.data.companyId && m.role === "COMPANY_ADMIN"
  );

  if (!isAdmin && !auth.isSuperAdmin) {
    return { error: "Only COMPANY_ADMIN can transfer admin role" };
  }

  const supabase = await createSupabaseServerClient();

  // Transfer COMPANY_ADMIN role to new user
  const { error: transferError } = await supabase
    .from("company_memberships")
    .update({ role: "COMPANY_ADMIN" })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", parsed.data.newAdminUserId);

  if (transferError) {
    return { error: `Failed to transfer admin role: ${transferError.message}` };
  }

  // Deactivate self membership
  const { error: selfError } = await supabase
    .from("company_memberships")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", auth.user.id);

  if (selfError) {
    return { error: `Failed to deactivate own membership: ${selfError.message}` };
  }

  // Also deactivate all team memberships for self
  await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", auth.user.id);

  // Fetch company name and send farewell email to self (best-effort)
  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", parsed.data.companyId)
    .single();

  const { data: sessionData } = await supabase.auth.getSession();
  if (companyRow?.name && sessionData?.session?.access_token) {
    await sendMembershipDisabledEmail(
      auth.user.id,
      companyRow.name,
      auth.profile.full_name ?? "yourself",
      sessionData.session.access_token
    );
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
  return { success: "Admin role transferred and membership deactivated" };
}

export async function transferTeamLeadAndLeaveAction(
  _previousState: DisableMembershipResult,
  formData: FormData
): Promise<DisableMembershipResult> {
  const parsed = transferTeamLeadSchema.safeParse({
    companyId: formData.get("companyId"),
    newTeamLeadUserId: formData.get("newAdminUserId"), // Reusing same field name from form
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const auth = await getAuthContext();

  // Verify current user is MANAGE_TEAM or COMPANY_ADMIN
  const canTransfer = auth.memberships.some(
    (m) =>
      m.company_id === parsed.data.companyId &&
      (m.role === "MANAGE_TEAM" || m.role === "COMPANY_ADMIN")
  );

  if (!canTransfer && !auth.isSuperAdmin) {
    return { error: "Only MANAGE_TEAM or COMPANY_ADMIN can transfer team lead role" };
  }

  const supabase = await createSupabaseServerClient();

  // Transfer MANAGE_TEAM role to new user
  const { error: transferError } = await supabase
    .from("company_memberships")
    .update({ role: "MANAGE_TEAM" })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", parsed.data.newTeamLeadUserId);

  if (transferError) {
    return { error: `Failed to transfer team lead role: ${transferError.message}` };
  }

  // Deactivate self membership
  const { error: selfError } = await supabase
    .from("company_memberships")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", auth.user.id);

  if (selfError) {
    return { error: `Failed to deactivate own membership: ${selfError.message}` };
  }

  // Also deactivate all team memberships for self
  await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("company_id", parsed.data.companyId)
    .eq("user_id", auth.user.id);

  // Fetch company name and send farewell email to self (best-effort)
  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", parsed.data.companyId)
    .single();

  const { data: sessionData } = await supabase.auth.getSession();
  if (companyRow?.name && sessionData?.session?.access_token) {
    await sendMembershipDisabledEmail(
      auth.user.id,
      companyRow.name,
      auth.profile.full_name ?? "yourself",
      sessionData.session.access_token
    );
  }

  revalidatePath("/team");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
  return { success: "Team lead role transferred and membership deactivated" };
}

export async function generateTeamInviteLinkAction(formData: FormData): Promise<{ link: string }> {
  const companyId = formData.get("companyId") as string;
  const teamId = formData.get("teamId") as string;
  const email = formData.get("email") as string;

  if (!companyId || !teamId || !email) {
    throw new Error("companyId, teamId and email are required");
  }

  const auth = await getAuthContext();
  const membership = auth.memberships.find((m) => m.company_id === companyId);
  if (!membership && !auth.isSuperAdmin) {
    throw new Error("You do not have permission to generate invite links");
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://devflow.tefasalcedo.com"}/auth/confirm?company=${companyId}&team=${teamId}`,
    },
  });

  if (error) throw new Error(error.message);

  return { link: data.properties.action_link };
}
