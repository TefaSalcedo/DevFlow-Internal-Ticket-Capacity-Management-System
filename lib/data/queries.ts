import { endOfWeek, format, startOfWeek } from "date-fns";

import type { AuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Company,
  Meeting,
  Membership,
  Project,
  TeamWorkloadItem,
  Ticket,
  TicketStatus,
  UserProfile,
} from "@/lib/types/domain";

interface MembershipWithProfile extends Membership {
  user_profiles:
    | Pick<UserProfile, "id" | "full_name" | "weekly_capacity_hours">
    | Array<Pick<UserProfile, "id" | "full_name" | "weekly_capacity_hours">>
    | null;
}

const BOARD_STATUSES: TicketStatus[] = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"];

function resolveDoneMonthRange(doneMonth?: string) {
  const match = doneMonth?.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { start, end };
}

function getScope(context: AuthContext, companyId?: string | null) {
  if (context.isSuperAdmin) {
    return {
      companyId: companyId ?? context.activeCompanyId,
      isGlobal: !companyId && !context.activeCompanyId,
    };
  }

  return {
    companyId: companyId ?? context.activeCompanyId,
    isGlobal: false,
  };
}

export async function getCompaniesForUser(context: AuthContext) {
  const supabase = await createSupabaseServerClient();

  if (context.isSuperAdmin) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug, created_at")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return (data ?? []) as Company[];
  }

  return context.memberships
    .map((membership) => {
      const company = Array.isArray(membership.companies)
        ? (membership.companies[0] ?? null)
        : (membership.companies ?? null);

      if (!company) {
        return null;
      }

      return {
        id: membership.company_id,
        name: company.name,
        slug: company.slug,
        created_at: "",
      };
    })
    .filter((company): company is Company => Boolean(company));
}

export async function getTicketBoard(
  context: AuthContext,
  companyId?: string | null,
  doneMonth?: string
) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);
  const doneRange = resolveDoneMonthRange(doneMonth);

  let query = supabase
    .from("tickets")
    .select(
      "id, company_id, project_id, title, description, status, priority, estimated_hours, due_date, assigned_to, workflow_stage, created_by, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  const tickets = (data ?? []) as Ticket[];

  return BOARD_STATUSES.map((status) => ({
    status,
    items: tickets.filter((ticket) => {
      if (ticket.status !== status) {
        return false;
      }

      if (status !== "DONE") {
        return true;
      }

      const createdAt = new Date(ticket.created_at);
      return createdAt >= doneRange.start && createdAt < doneRange.end;
    }),
  }));
}

export async function getProjects(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let query = supabase
    .from("projects")
    .select("id, company_id, name, code, status, created_at")
    .order("created_at", { ascending: false });

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return (data ?? []) as Project[];
}

export async function getMeetings(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let query = supabase
    .from("meetings")
    .select("id, company_id, title, starts_at, ends_at, participants")
    .order("starts_at", { ascending: true })
    .limit(100);

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch meetings: ${error.message}`);
  }

  return (data ?? []) as Meeting[];
}

function durationHours(start: string, end: string) {
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  return Math.max((endDate - startDate) / 3_600_000, 0);
}

export async function getTeamWorkload(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  if (!scope.companyId) {
    return [];
  }

  const [
    { data: membershipsData, error: membershipsError },
    { data: ticketsData, error: ticketsError },
  ] = await Promise.all([
    supabase
      .from("company_memberships")
      .select(
        "id, company_id, user_id, role, is_active, user_profiles!inner(id, full_name, weekly_capacity_hours)"
      )
      .eq("company_id", scope.companyId)
      .eq("is_active", true),
    supabase
      .from("tickets")
      .select("assigned_to, estimated_hours")
      .eq("company_id", scope.companyId)
      .neq("status", "DONE"),
  ]);

  if (membershipsError) {
    throw new Error(`Failed to fetch team memberships: ${membershipsError.message}`);
  }

  if (ticketsError) {
    throw new Error(`Failed to fetch team ticket assignments: ${ticketsError.message}`);
  }

  const members = ((membershipsData ?? []) as MembershipWithProfile[])
    .map((membership) => {
      const profile = Array.isArray(membership.user_profiles)
        ? (membership.user_profiles[0] ?? null)
        : membership.user_profiles;

      if (!profile) {
        return null;
      }

      return {
        ...membership,
        user_profiles: profile,
      };
    })
    .filter(
      (
        member
      ): member is Membership & {
        user_profiles: Pick<UserProfile, "id" | "full_name" | "weekly_capacity_hours">;
      } => Boolean(member)
    );

  const memberIds = members.map((item) => item.user_id);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: meetingsData, error: meetingsError } = await supabase
    .from("meetings")
    .select("participants, starts_at, ends_at")
    .eq("company_id", scope.companyId)
    .gte("starts_at", weekStart.toISOString())
    .lte("starts_at", weekEnd.toISOString());

  if (meetingsError) {
    throw new Error(`Failed to fetch team meetings: ${meetingsError.message}`);
  }

  const assignedMap = new Map<string, number>();
  (ticketsData ?? []).forEach((ticket) => {
    if (!ticket.assigned_to) {
      return;
    }

    const current = assignedMap.get(ticket.assigned_to) ?? 0;
    assignedMap.set(ticket.assigned_to, current + Number(ticket.estimated_hours ?? 0));
  });

  const meetingsMap = new Map<string, number>();
  (meetingsData ?? []).forEach((meeting) => {
    const participants = Array.isArray(meeting.participants)
      ? (meeting.participants as string[])
      : [];
    const hours = durationHours(meeting.starts_at, meeting.ends_at);

    participants.forEach((participantId) => {
      if (!memberIds.includes(participantId)) {
        return;
      }

      const current = meetingsMap.get(participantId) ?? 0;
      meetingsMap.set(participantId, current + hours);
    });
  });

  return members.map((member) => {
    const assignedHours = assignedMap.get(member.user_id) ?? 0;
    const meetingHours = meetingsMap.get(member.user_id) ?? 0;
    const weeklyCapacity = Number(member.user_profiles.weekly_capacity_hours ?? 40);

    return {
      userId: member.user_id,
      fullName: member.user_profiles.full_name,
      role: member.role,
      weeklyCapacity,
      assignedHours,
      meetingHours,
      remaining: weeklyCapacity - assignedHours - meetingHours,
    } satisfies TeamWorkloadItem;
  });
}

export async function getDashboardSnapshot(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let ticketQuery = supabase
    .from("tickets")
    .select("id, status, priority, estimated_hours, assigned_to, title, due_date, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (scope.companyId) {
    ticketQuery = ticketQuery.eq("company_id", scope.companyId);
  }

  const [{ data: ticketsData, error: ticketsError }, teamData, meetingsData] = await Promise.all([
    ticketQuery,
    getTeamWorkload(context, scope.companyId),
    getMeetings(context, scope.companyId),
  ]);

  if (ticketsError) {
    throw new Error(`Failed to fetch dashboard tickets: ${ticketsError.message}`);
  }

  const tickets = (ticketsData ?? []) as Array<
    Pick<
      Ticket,
      "id" | "status" | "priority" | "estimated_hours" | "assigned_to" | "title" | "due_date"
    > & {
      created_at: string;
    }
  >;

  const totalTickets = tickets.length;
  const urgentTickets = tickets.filter((ticket) => ticket.priority === "URGENT");
  const statusCount = BOARD_STATUSES.reduce<Record<TicketStatus, number>>(
    (acc, status) => {
      acc[status] = tickets.filter((ticket) => ticket.status === status).length;
      return acc;
    },
    {
      BACKLOG: 0,
      ACTIVE: 0,
      BLOCKED: 0,
      DONE: 0,
    }
  );

  const weeklyAssigned = teamData.reduce((acc, member) => acc + member.assignedHours, 0);
  const weeklyCapacity = teamData.reduce((acc, member) => acc + member.weeklyCapacity, 0);

  return {
    totalTickets,
    urgentTickets,
    statusCount,
    weeklyAssigned,
    weeklyCapacity,
    teamData,
    meetingsToday: meetingsData.filter((meeting) => {
      const today = format(new Date(), "yyyy-MM-dd");
      return format(new Date(meeting.starts_at), "yyyy-MM-dd") === today;
    }),
    recentUrgent: urgentTickets.slice(0, 5),
  };
}

export async function getSuperAdminSnapshot(context: AuthContext) {
  if (!context.isSuperAdmin) {
    return {
      companies: [] as Company[],
      memberships: [] as Membership[],
      profiles: [] as UserProfile[],
    };
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: companiesData, error: companiesError },
    { data: membershipsData, error: membershipsError },
    { data: profilesData, error: profilesError },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("company_memberships")
      .select("id, company_id, user_id, role, is_active, companies(name, slug)")
      .order("id", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("id, email, full_name, global_role, weekly_capacity_hours")
      .order("full_name", { ascending: true }),
  ]);

  if (companiesError) {
    throw new Error(`Failed to fetch super admin companies: ${companiesError.message}`);
  }

  if (membershipsError) {
    throw new Error(`Failed to fetch super admin memberships: ${membershipsError.message}`);
  }

  if (profilesError) {
    throw new Error(`Failed to fetch super admin profiles: ${profilesError.message}`);
  }

  return {
    companies: (companiesData ?? []) as Company[],
    memberships: ((membershipsData ?? []) as Membership[]).map((membership) => ({
      ...membership,
      companies: Array.isArray(membership.companies)
        ? (membership.companies[0] ?? null)
        : (membership.companies ?? null),
    })),
    profiles: (profilesData ?? []) as UserProfile[],
  };
}
