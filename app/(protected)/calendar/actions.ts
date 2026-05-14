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

export interface UpdateCalendarEventState {
  error?: string;
}

export interface DeleteCalendarEventState {
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

  // Allow any active company member to create events (not just specific roles)
  const canCreateInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) => membership.company_id === payload.companyId && membership.is_active
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
      .select("user_id")
      .eq("company_id", payload.companyId)
      .eq("is_active", true)
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

export async function updateCalendarEventAction(
  _previousState: UpdateCalendarEventState,
  formData: FormData
): Promise<UpdateCalendarEventState> {
  const eventId = formData.get("eventId");
  if (!eventId || typeof eventId !== "string") {
    return { error: "Missing event ID" };
  }

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

  const supabase = await createSupabaseServerClient();

  // Check if user is organizer or has admin permissions
  const { data: event } = await supabase
    .from("meetings")
    .select("organizer_id, company_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Event not found" };
  }

  const isOrganizer = event.organizer_id === auth.user.id;
  // Allow any active company member to edit events (not just specific roles)
  const canEditInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) => membership.company_id === event.company_id && membership.is_active
      );

  if (!isOrganizer && !canEditInCompany) {
    return {
      error: "You do not have permission to edit this event",
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

  if (payload.participantIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", payload.companyId)
      .eq("is_active", true)
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

  const { error } = await supabase
    .from("meetings")
    .update({
      company_id: payload.companyId,
      title: payload.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      participants: payload.participantIds,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    return {
      error: error.message,
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/calendar");
}

export async function deleteCalendarEventAction(
  _previousState: DeleteCalendarEventState,
  formData: FormData
): Promise<DeleteCalendarEventState> {
  const eventId = formData.get("eventId");
  if (!eventId || typeof eventId !== "string") {
    return { error: "Missing event ID" };
  }

  const auth = await getAuthContext();
  const supabase = await createSupabaseServerClient();

  // Check if user is organizer or has admin permissions
  const { data: event } = await supabase
    .from("meetings")
    .select("organizer_id, company_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Event not found" };
  }

  const isOrganizer = event.organizer_id === auth.user.id;
  // Allow any active company member to delete events (not just specific roles)
  const canDeleteInCompany = auth.isSuperAdmin
    ? true
    : auth.memberships.some(
        (membership) => membership.company_id === event.company_id && membership.is_active
      );

  if (!isOrganizer && !canDeleteInCompany) {
    return {
      error: "You do not have permission to delete this event",
    };
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      deleted_by: auth.user.id,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    return {
      error: error.message,
    };
  }

  console.log("Deleting event:", eventId);
  console.log("User:", auth.user.id, "isSuperAdmin:", auth.isSuperAdmin);
  console.log("Memberships:", auth.memberships);

  // First check if we can see the event
  const { data: checkData, error: checkError } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", eventId)
    .single();
  console.log("Check event exists:", { checkData, checkError });

  const { error: deleteError, data } = await supabase.from("meetings").delete().eq("id", eventId);

  console.log("Delete result:", { deleteError, data });

  if (deleteError) {
    return {
      error: deleteError.message,
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return {};
}

// Simple version for client-side form action (no previousState)
export async function deleteEventSimpleAction(formData: FormData) {
  await deleteCalendarEventAction({}, formData);
}
