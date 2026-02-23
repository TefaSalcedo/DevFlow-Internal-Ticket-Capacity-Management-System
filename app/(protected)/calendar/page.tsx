import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";

import { CalendarEventForm } from "@/app/(protected)/calendar/event-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import {
  getCalendarMembers,
  getCalendarTickets,
  getCompaniesForUser,
  getMeetings,
} from "@/lib/data/queries";

function stageLabel(workflowStage: "DEVELOPMENT" | "QA" | "PR_REVIEW") {
  if (workflowStage === "PR_REVIEW") {
    return "PR Review";
  }

  if (workflowStage === "QA") {
    return "QA";
  }

  return "DEV";
}

function statusTone(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "BUG" | "DESIGN" | "DONE") {
  if (status === "DONE") {
    return "success" as const;
  }

  if (status === "BLOCKED") {
    return "danger" as const;
  }

  if (status === "ACTIVE") {
    return "info" as const;
  }

  if (status === "BUG") {
    return "danger" as const;
  }

  if (status === "DESIGN") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function priorityTone(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") {
  if (priority === "URGENT") {
    return "danger" as const;
  }

  if (priority === "HIGH") {
    return "warning" as const;
  }

  if (priority === "LOW") {
    return "neutral" as const;
  }

  return "info" as const;
}

function timelineBarColor(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "BUG" | "DESIGN" | "DONE") {
  if (status === "DONE") {
    return "#059669";
  }

  if (status === "BLOCKED") {
    return "#dc2626";
  }

  if (status === "ACTIVE") {
    return "#2563eb";
  }

  if (status === "BUG") {
    return "#dc2626";
  }

  if (status === "DESIGN") {
    return "#a21caf";
  }

  return "#64748b";
}

interface TimelineTicketItem {
  id: string;
  title: string;
  status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "BUG" | "DESIGN" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_date: string;
  leftPercent: number;
  widthPercent: number;
}

export default async function CalendarPage() {
  const auth = await getAuthContext();
  const [meetings, tickets, members, companies] = await Promise.all([
    getMeetings(auth),
    getCalendarTickets(auth),
    getCalendarMembers(auth),
    getCompaniesForUser(auth),
  ]);

  const canCreateEvents =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === auth.activeCompanyId &&
        ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
    );

  const grouped = meetings.reduce<Record<string, typeof meetings>>((acc, meeting) => {
    const key = format(new Date(meeting.starts_at), "yyyy-MM-dd");
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(meeting);
    return acc;
  }, {});

  const ticketDueGrouped = tickets.reduce<Record<string, typeof tickets>>((acc, ticket) => {
    const key = format(new Date(`${ticket.due_date}T00:00:00`), "yyyy-MM-dd");
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(ticket);
    return acc;
  }, {});

  const dayKeys = Array.from(
    new Set([...Object.keys(grouped), ...Object.keys(ticketDueGrouped)])
  ).sort((a, b) => (a < b ? -1 : 1));

  const timelineWindowDays = 21;
  const timelineStart = startOfDay(new Date());
  const timelineEnd = addDays(timelineStart, timelineWindowDays - 1);
  const timelineColumns = Array.from({ length: timelineWindowDays }, (_, index) => {
    return addDays(timelineStart, index);
  });
  const timelineTickets: TimelineTicketItem[] = tickets
    .filter((ticket) => ticket.status !== "DONE")
    .map((ticket) => {
      const createdAt = startOfDay(new Date(ticket.created_at));
      const dueAt = startOfDay(new Date(`${ticket.due_date}T00:00:00`));

      const boundedStart = createdAt < timelineStart ? timelineStart : createdAt;
      const boundedEnd = dueAt > timelineEnd ? timelineEnd : dueAt;

      if (boundedEnd < timelineStart || boundedStart > timelineEnd) {
        return null;
      }

      const left = differenceInCalendarDays(boundedStart, timelineStart);
      const span = Math.max(differenceInCalendarDays(boundedEnd, boundedStart) + 1, 1);
      const unitPercent = 100 / timelineWindowDays;

      return {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        due_date: ticket.due_date,
        leftPercent: left * unitPercent,
        widthPercent: Math.max(span * unitPercent, unitPercent),
      };
    })
    .filter((ticket): ticket is TimelineTicketItem => Boolean(ticket));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planning</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Calendar</h2>
        <p className="mt-1 text-sm text-slate-600">
          Events + ticket due dates in a practical Gantt-style tracking view.
        </p>
      </header>

      {canCreateEvents && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Create Event
          </h3>
          <div className="mt-3">
            <CalendarEventForm
              companies={companies.map((company) => ({ id: company.id, name: company.name }))}
              members={members}
              defaultCompanyId={auth.activeCompanyId ?? undefined}
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {dayKeys.length === 0 ? (
          <p className="text-sm text-slate-500">
            No meetings or ticket due dates available in your scope.
          </p>
        ) : (
          <div className="space-y-6">
            {dayKeys.map((day) => (
              <article key={day}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {day}
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(grouped[day] ?? []).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {format(new Date(meeting.starts_at), "HH:mm")} -{" "}
                        {format(new Date(meeting.ends_at), "HH:mm")}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Participants: {meeting.participants.length}
                      </p>
                    </div>
                  ))}

                  {(ticketDueGrouped[day] ?? []).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-blue-200 bg-blue-50/55 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ticket.title}</p>
                        <div className="flex items-center gap-1">
                          <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
                          <StatusBadge
                            label={ticket.priority}
                            tone={priorityTone(ticket.priority)}
                          />
                          <StatusBadge label={stageLabel(ticket.workflow_stage)} tone="neutral" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Ticket due date milestone</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ticket Timeline (Gantt Lite)
          </h3>
          <p className="text-xs text-slate-500">
            {format(timelineStart, "yyyy-MM-dd")} → {format(timelineEnd, "yyyy-MM-dd")}
          </p>
        </div>

        {timelineTickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No active tickets with due dates in the next 3 weeks.
          </p>
        ) : (
          <div className="mt-4 space-y-3 overflow-x-auto">
            <div
              className="grid min-w-[900px] gap-2 text-[11px] text-slate-500"
              style={{
                gridTemplateColumns: `280px repeat(${timelineWindowDays}, minmax(32px, 1fr))`,
              }}
            >
              <div className="font-semibold uppercase tracking-wide text-slate-500">Ticket</div>
              {timelineColumns.map((day) => (
                <div key={day.toISOString()} className="text-center">
                  {format(day, "dd")}
                </div>
              ))}
            </div>

            {timelineTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="grid min-w-[900px] items-center gap-2"
                style={{
                  gridTemplateColumns: `280px repeat(${timelineWindowDays}, minmax(32px, 1fr))`,
                }}
              >
                <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-slate-800">{ticket.title}</p>
                  <p className="text-[11px] text-slate-500">
                    Due {format(new Date(`${ticket.due_date}T00:00:00`), "MMM dd")} ·{" "}
                    {ticket.priority}
                  </p>
                </div>

                <div className="relative col-span-21 h-9 rounded-md border border-slate-200 bg-slate-50">
                  <div
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm"
                    style={{
                      left: `${ticket.leftPercent}%`,
                      width: `${ticket.widthPercent}%`,
                      backgroundColor: timelineBarColor(ticket.status),
                    }}
                    title={`${ticket.title} (${ticket.status})`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
