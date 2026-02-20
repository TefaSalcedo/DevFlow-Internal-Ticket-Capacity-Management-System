"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const companySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
});

const membershipSchema = z.object({
  companyId: z.string().uuid(),
  userEmail: z.email(),
  role: z.enum(["COMPANY_ADMIN", "TICKET_CREATOR", "READER"]),
});

export interface AdminActionState {
  error?: string;
  success?: string;
}

export async function createCompanyAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const auth = await getAuthContext();
  if (!auth.isSuperAdmin) {
    return { error: "Only SUPER_ADMIN users can create companies" };
  }

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid company payload" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    created_by: auth.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/super-admin");
  return { success: "Company created successfully" };
}

export async function assignMembershipAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const auth = await getAuthContext();
  if (!auth.isSuperAdmin) {
    return { error: "Only SUPER_ADMIN users can assign memberships" };
  }

  const parsed = membershipSchema.safeParse({
    companyId: formData.get("companyId"),
    userEmail: formData.get("userEmail"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid membership payload" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", parsed.data.userEmail)
    .single();

  if (profileError || !profile) {
    return {
      error: "User profile not found. Ask the user to sign in once before assignment.",
    };
  }

  const { error } = await supabase.from("company_memberships").upsert(
    {
      company_id: parsed.data.companyId,
      user_id: profile.id,
      role: parsed.data.role,
      is_active: true,
    },
    { onConflict: "company_id,user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/super-admin");
  return { success: "Membership assigned successfully" };
}
