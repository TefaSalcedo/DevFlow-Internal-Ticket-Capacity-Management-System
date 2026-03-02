"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
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

const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
  companyId: z.string().uuid(),
});

function normalizeProjectCode(rawCode: FormDataEntryValue | null) {
  if (typeof rawCode !== "string") {
    return "";
  }

  return rawCode.trim().toUpperCase().replace(/\s+/g, "-");
}

function canManageProjects(auth: Awaited<ReturnType<typeof getAuthContext>>, companyId: string) {
  if (auth.isSuperAdmin) {
    return true;
  }

  return auth.memberships.some(
    (membership) => membership.company_id === companyId && membership.role === "COMPANY_ADMIN"
  );
}

export async function updateProjectAction(formData: FormData) {
  const parsed = updateProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    code: normalizeProjectCode(formData.get("code")),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project update payload",
    };
  }

  const auth = await getAuthContext();
  if (!canManageProjects(auth, parsed.data.companyId)) {
    return {
      error: "You do not have permission to update this project",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.projectId)
    .eq("company_id", parsed.data.companyId);

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

  return { success: true };
}

export async function deleteProjectAction(formData: FormData) {
  const parsed = deleteProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    companyId: formData.get("companyId"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project delete payload",
    };
  }

  const auth = await getAuthContext();
  if (!canManageProjects(auth, parsed.data.companyId)) {
    return {
      error: "You do not have permission to delete this project",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", parsed.data.projectId)
    .eq("company_id", parsed.data.companyId);

  if (error) {
    return {
      error: error.message,
    };
  }

  revalidatePath("/projects");
  revalidatePath("/tickets");
  revalidatePath("/tickets/new");
  revalidatePath("/dashboard");

  return { success: true };
}
