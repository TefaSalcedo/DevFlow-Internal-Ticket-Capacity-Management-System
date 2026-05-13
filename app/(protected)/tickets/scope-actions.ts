"use server";

import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { upsertPreferredTeamIdForUser } from "@/lib/data/queries";

function parseProjectIds(values: FormDataEntryValue[]): string[] {
  const entries = values
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(entries));
}

export async function applyTicketScopeAction(formData: FormData) {
  const auth = await getAuthContext();

  const doneMonthRaw = formData.get("doneMonth");
  const doneMonth =
    typeof doneMonthRaw === "string" && /^\d{4}-\d{2}$/.test(doneMonthRaw)
      ? doneMonthRaw
      : `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

  const companyIdRaw = formData.get("companyId");
  const companyId =
    typeof companyIdRaw === "string" && companyIdRaw.length > 0 ? companyIdRaw : null;

  const teamRaw = formData.get("team");
  const teamId = typeof teamRaw === "string" && teamRaw.length > 0 ? teamRaw : null;

  const assignedUserRaw = formData.get("assignedUser");
  const assignedUserId =
    typeof assignedUserRaw === "string" && assignedUserRaw.length > 0 ? assignedUserRaw : null;

  const clearProjects = formData.get("clearProjects") === "1";
  const projectIds = clearProjects ? [] : parseProjectIds(formData.getAll("projects"));

  await upsertPreferredTeamIdForUser(auth, {
    companyId,
    teamId,
  });

  const params = new URLSearchParams();
  params.set("doneMonth", doneMonth);

  if (teamId) {
    params.set("team", teamId);
  }

  if (assignedUserId) {
    params.set("assignedUser", assignedUserId);
  }

  if (projectIds.length > 0) {
    params.set("projects", projectIds.join(","));
  }

  redirect(`/tickets?${params.toString()}`);
}
