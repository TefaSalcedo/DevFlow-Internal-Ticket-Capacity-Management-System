import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Membership, UserProfile } from "@/lib/types/domain";

export interface AuthContext {
  user: User;
  profile: UserProfile;
  memberships: Membership[];
  isSuperAdmin: boolean;
  activeCompanyId: string | null;
}

async function ensureProfile(user: User): Promise<UserProfile> {
  const supabase = await createSupabaseServerClient();
  const fallbackName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "Team Member";

  await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: fallbackName,
    },
    { onConflict: "id" }
  );

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, global_role, weekly_capacity_hours")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error(`Failed to resolve user profile: ${error?.message ?? "unknown error"}`);
  }

  return profile as UserProfile;
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await ensureProfile(user);

  const { data: membershipsData, error } = await supabase
    .from("company_memberships")
    .select("id, company_id, user_id, role, is_active, companies(name, slug)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("role", { ascending: true });

  if (error) {
    throw new Error(`Failed to load memberships: ${error.message}`);
  }

  const memberships = ((membershipsData ?? []) as Membership[]).map((membership) => ({
    ...membership,
    companies: Array.isArray(membership.companies)
      ? (membership.companies[0] ?? null)
      : (membership.companies ?? null),
  }));
  const isSuperAdmin = profile.global_role === "SUPER_ADMIN";

  return {
    user,
    profile,
    memberships,
    isSuperAdmin,
    activeCompanyId: memberships[0]?.company_id ?? null,
  };
}

export async function getSessionOrNull() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
