"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createCalendarEventSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAtTime: z.string().regex(/^\d{2}:\d{2}$/),
  endsAtTime: z.string().regex(/^\d{2}:\d{2}$/),
  participantIds: z.array(z.string().uuid()).max(30),
});

export interface CreateCalendarEventState {
  error?: string;
}

function extractParticipantIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("participantIds")
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
}

export async function createCalendarEventAction(
  _previousState: CreateCalendarEventState,
  formData: FormData
): Promise<CreateCalendarEventState> {
  const parsed = createCalendarEventSchema.safeParse({
    companyId: formData.get("companyId"),
    title: formData.get("title"),
    date: formData.get("date"),
    startsAtTime: formData.get("startsAtTime"),
    endsAtTime: formData.get("endsAtTime"),
    participantIds: extractParticipantIds(formData),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid calendar event payload",
    };
  }

  const auth = await getAuthContext();
  const payload = parsed.data;

  const canCreateInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) =>
          membership.company_id === payload.companyId &&
          ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
      );

  if (!canCreateInCompany) {
    return {
      error: "You do not have permission to create events in this company",
    };
  }

  const startsAt = new Date(`${payload.date}T${payload.startsAtTime}:00`);
  const endsAt = new Date(`${payload.date}T${payload.endsAtTime}:00`);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return {
      error: "Invalid date or time range",
    };
  }

  if (endsAt <= startsAt) {
    return {
      error: "Event end time must be after start time",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (payload.participantIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("company_memberships")
      .select("user_id, user_profiles!inner(global_role)")
      .eq("company_id", payload.companyId)
      .eq("is_active", true)
      .neq("user_profiles.global_role", "SUPER_ADMIN")
      .in("user_id", payload.participantIds);

    if (membershipError) {
      return {
        error: membershipError.message,
      };
    }

    if ((membershipRows ?? []).length !== payload.participantIds.length) {
      return {
        error: "Some selected participants are not active members of this company",
      };
    }
  }

  const { error } = await supabase.from("meetings").insert({
    company_id: payload.companyId,
    title: payload.title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    participants: payload.participantIds,
    organizer_id: auth.user.id,
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/calendar");
}
