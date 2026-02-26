import { endOfWeek, format, startOfWeek } from "date-fns";

import type { AuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Board,
  Company,
  Meeting,
  Membership,
  Project,
  Team,
  TeamWorkloadItem,
  Ticket,
  TicketAssignee,
  TicketPriority,
  TicketStatus,
  TicketWorkflowStage,
  UserProfile,
} from "@/lib/types/domain";

interface MembershipWithProfile extends Membership {
  user_profiles:
    | Pick<UserProfile, "id" | "full_name" | "weekly_capacity_hours">
    | Array<Pick<UserProfile, "id" | "full_name" | "weekly_capacity_hours">>
    | null;
}

export async function getTeams(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let query = supabase
    .from("teams")
    .select("id, company_id, name, created_at, updated_at")
    .order("name", { ascending: true });

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  return (data ?? []) as Team[];
}

export async function getBoards(
  context: AuthContext,
  filters: {
    companyId?: string | null;
    teamId?: string | null;
  } = {}
) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, filters.companyId);

  let query = supabase
    .from("boards")
    .select("id, company_id, team_id, name, description, order_index, created_at, updated_at")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  if (filters.teamId) {
    query = query.eq("team_id", filters.teamId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch boards: ${error.message}`);
  }

  return (data ?? []) as Board[];
}

export async function getAssignedTicketsForCurrentUser(
  context: AuthContext,
  filters: AssignedTicketFilters = {}
) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, filters.companyId);

  let query = supabase
    .from("ticket_assignees")
    .select(
      "ticket_id, company_id, user_id, assigned_at, tickets!inner(id, company_id, team_id, board_id, project_id, title, description, status, priority, estimated_hours, due_date, assigned_to, workflow_stage, created_by, created_at, boards(id, name, team_id, teams(id, name)))"
    )
    .eq("user_id", context.user.id)
    .order("assigned_at", { ascending: false })
    .limit(500);

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  if (filters.teamId) {
    query = query.eq("tickets.team_id", filters.teamId);
  }

  if (filters.boardId) {
    query = query.eq("tickets.board_id", filters.boardId);
  }

  if (filters.status) {
    query = query.eq("tickets.status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("tickets.priority", filters.priority);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch assigned tickets: ${error.message}`);
  }

  return ((data ?? []) as AssignedTicketRow[])
    .map((row) => {
      const ticket = Array.isArray(row.tickets) ? (row.tickets[0] ?? null) : row.tickets;

      if (!ticket) {
        return null;
      }

      const boardRaw = Array.isArray(ticket.boards) ? (ticket.boards[0] ?? null) : ticket.boards;
      const teamRaw = boardRaw
        ? Array.isArray(boardRaw.teams)
          ? (boardRaw.teams[0] ?? null)
          : boardRaw.teams
        : null;
      const { boards: _ignoredBoardRelation, ...ticketRecord } = ticket;

      return {
        assignment_company_id: row.company_id,
        assignment_user_id: row.user_id,
        assigned_at: row.assigned_at,
        ticket: {
          ...ticketRecord,
          assignees: undefined,
        },
        board: boardRaw
          ? {
              id: boardRaw.id,
              name: boardRaw.name,
              team_id: boardRaw.team_id,
            }
          : null,
        team: teamRaw
          ? {
              id: teamRaw.id,
              name: teamRaw.name,
            }
          : null,
      } satisfies AssignedTicketItem;
    })
    .filter(Boolean) as AssignedTicketItem[];
}

interface TicketAssigneeRow {
  user_id: string;
  user_profiles:
    | Pick<UserProfile, "id" | "full_name">
    | Array<Pick<UserProfile, "id" | "full_name">>
    | null;
}

interface TicketHistoryActorRow {
  full_name: string;
}

interface TicketHistoryRow {
  id: string;
  event_type: string;
  field_name: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  actor: TicketHistoryActorRow | TicketHistoryActorRow[] | null;
}

interface TicketCreatorRow {
  full_name: string;
}

interface TicketBoardRow extends Ticket {
  creator?: TicketCreatorRow | TicketCreatorRow[] | null;
  ticket_history?: TicketHistoryRow[] | null;
  ticket_assignees?: TicketAssigneeRow[] | null;
}

interface AssignedTicketRow {
  ticket_id: string;
  company_id: string;
  user_id: string;
  assigned_at: string;
  tickets:
    | (Ticket & {
        boards:
          | {
              id: string;
              name: string;
              team_id: string;
              teams:
                | {
                    id: string;
                    name: string;
                  }
                | Array<{
                    id: string;
                    name: string;
                  }>
                | null;
            }
          | Array<{
              id: string;
              name: string;
              team_id: string;
              teams:
                | {
                    id: string;
                    name: string;
                  }
                | Array<{
                    id: string;
                    name: string;
                  }>
                | null;
            }>
          | null;
      })
    | Array<
        Ticket & {
          boards:
            | {
                id: string;
                name: string;
                team_id: string;
                teams:
                  | {
                      id: string;
                      name: string;
                    }
                  | Array<{
                      id: string;
                      name: string;
                    }>
                  | null;
              }
            | Array<{
                id: string;
                name: string;
                team_id: string;
                teams:
                  | {
                      id: string;
                      name: string;
                    }
                  | Array<{
                      id: string;
                      name: string;
                    }>
                  | null;
              }>
            | null;
        }
      >
    | null;
}

interface TeamTicketAssignmentRow {
  assigned_to: string | null;
  estimated_hours: number;
  ticket_assignees?: Array<{
    user_id: string;
  }> | null;
}

export interface CalendarTicketItem {
  id: string;
  company_id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  workflow_stage: TicketWorkflowStage;
  due_date: string;
  created_at: string;
}

export interface CalendarMemberOption {
  company_id: string;
  user_id: string;
  full_name: string;
  role: Membership["role"];
}

export interface BoardTicketFilters {
  companyId?: string | null;
  teamId?: string | null;
  boardId?: string | null;
  doneMonth?: string;
}

export interface AssignedTicketFilters {
  companyId?: string | null;
  teamId?: string | null;
  boardId?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
}

export interface AssignedTicketItem {
  assignment_company_id: string;
  assignment_user_id: string;
  assigned_at: string;
  ticket: Ticket;
  board: {
    id: string;
    name: string;
    team_id: string;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
}

const BOARD_STATUSES: TicketStatus[] = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"];

function normalizeTicketAssignees(
  assignees: TicketAssigneeRow[] | null | undefined
): TicketAssignee[] {
  return (assignees ?? [])
    .map((assignee) => {
      const profile = Array.isArray(assignee.user_profiles)
        ? (assignee.user_profiles[0] ?? null)
        : assignee.user_profiles;

      if (!profile) {
        return null;
      }

      return {
        user_id: assignee.user_id,
        full_name: profile.full_name,
      };
    })
    .filter((assignee): assignee is TicketAssignee => Boolean(assignee));
}

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

export async function getTicketBoard(context: AuthContext, filters: BoardTicketFilters = {}) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, filters.companyId);
  const doneRange = resolveDoneMonthRange(filters.doneMonth);

  let query = supabase
    .from("tickets")
    .select(
      "id, company_id, team_id, board_id, project_id, title, description, status, priority, estimated_hours, due_date, assigned_to, workflow_stage, created_by, created_at, creator:user_profiles!tickets_created_by_fkey(full_name), ticket_history(id, event_type, field_name, from_value, to_value, created_at, actor:user_profiles!ticket_history_actor_user_id_fkey(full_name)), ticket_assignees(user_id, user_profiles!ticket_assignees_user_id_fkey(id, full_name))"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  if (filters.teamId) {
    query = query.eq("team_id", filters.teamId);
  }

  if (filters.boardId) {
    query = query.eq("board_id", filters.boardId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  const tickets = ((data ?? []) as TicketBoardRow[]).map((ticket) => ({
    ...ticket,
    created_by_name: (() => {
      const creator = Array.isArray(ticket.creator) ? (ticket.creator[0] ?? null) : ticket.creator;
      return creator?.full_name ?? null;
    })(),
    history: (ticket.ticket_history ?? [])
      .map((entry) => {
        const actor = Array.isArray(entry.actor) ? (entry.actor[0] ?? null) : entry.actor;
        return {
          id: entry.id,
          event_type: entry.event_type,
          field_name: entry.field_name,
          from_value: entry.from_value,
          to_value: entry.to_value,
          created_at: entry.created_at,
          actor_name: actor?.full_name ?? null,
        };
      })
      .sort((left, right) => {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }),
    assignees: normalizeTicketAssignees(ticket.ticket_assignees),
  }));

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

export async function getCalendarMembers(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let query = supabase
    .from("company_memberships")
    .select("company_id, user_id, role, user_profiles!inner(full_name)")
    .eq("is_active", true)
    .order("company_id", { ascending: true });

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch calendar members: ${error.message}`);
  }

  return (
    (data ?? []) as Array<{
      company_id: string;
      user_id: string;
      role: Membership["role"];
      user_profiles:
        | {
            full_name: string;
          }
        | Array<{
            full_name: string;
          }>
        | null;
    }>
  )
    .map((row) => {
      const profile = Array.isArray(row.user_profiles)
        ? (row.user_profiles[0] ?? null)
        : row.user_profiles;

      if (!profile) {
        return null;
      }

      return {
        company_id: row.company_id,
        user_id: row.user_id,
        full_name: profile.full_name,
        role: row.role,
      } satisfies CalendarMemberOption;
    })
    .filter((member): member is CalendarMemberOption => Boolean(member));
}

export async function getCalendarTickets(context: AuthContext, companyId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const scope = getScope(context, companyId);

  let query = supabase
    .from("tickets")
    .select("id, company_id, title, status, priority, workflow_stage, due_date, created_at")
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(400);

  if (scope.companyId) {
    query = query.eq("company_id", scope.companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch calendar tickets: ${error.message}`);
  }

  return (data ?? []) as CalendarTicketItem[];
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
      .select("assigned_to, estimated_hours, ticket_assignees(user_id)")
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
  ((ticketsData ?? []) as TeamTicketAssignmentRow[]).forEach((ticket) => {
    const nestedAssignees = (ticket.ticket_assignees ?? []).map((item) => item.user_id);
    const fallbackAssignees = ticket.assigned_to ? [ticket.assigned_to] : [];
    const assigneeIds = Array.from(new Set([...nestedAssignees, ...fallbackAssignees]));

    if (assigneeIds.length === 0) {
      return;
    }

    const splitHours = Number(ticket.estimated_hours ?? 0) / assigneeIds.length;

    assigneeIds.forEach((assigneeId) => {
      const current = assignedMap.get(assigneeId) ?? 0;
      assignedMap.set(assigneeId, current + splitHours);
    });
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
