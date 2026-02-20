"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const projectSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain uppercase letters, numbers, - and _"),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
});

export interface CreateProjectState {
  error?: string;
}

function normalizeProjectCode(rawCode: FormDataEntryValue | null) {
  if (typeof rawCode !== "string") {
    return "";
  }

  return rawCode.trim().toUpperCase().replace(/\s+/g, "-");
}

export async function createProjectAction(
  _previousState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const parsed = projectSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    code: normalizeProjectCode(formData.get("code")),
    status: formData.get("status") || "ACTIVE",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project payload",
    };
  }

  const auth = await getAuthContext();
  const canCreateInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) =>
          membership.company_id === parsed.data.companyId && membership.role === "COMPANY_ADMIN"
      );

  if (!canCreateInCompany) {
    return {
      error: "You do not have permission to create projects in this company",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = parsed.data;

  const { error } = await supabase.from("projects").insert({
    company_id: payload.companyId,
    name: payload.name,
    code: payload.code,
    status: payload.status,
    created_by: auth.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A project with that code already exists in this company",
      };
    }

    return {
      error: error.message,
    };
  }

  revalidatePath("/projects");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
  revalidatePath("/dashboard");

  redirect("/projects");
}
