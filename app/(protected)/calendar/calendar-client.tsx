"use client";

import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  type DeleteCalendarEventState,
  deleteCalendarEventAction,
} from "@/app/(protected)/calendar/actions";
import { CreateEventModal } from "@/app/(protected)/calendar/create-event-modal";
import { EditEventModal } from "@/app/(protected)/calendar/edit-event-modal";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuthContext } from "@/lib/auth/session";
import type { TicketWorkflowStage } from "@/lib/types/domain";

interface CalendarClientProps {
  auth: AuthContext;
  meetings: Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    participants: string[];
    organizer_id: string;
    company_id: string;
  }>;
  tickets: Array<{
    id: string;
    title: string;
    status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    workflow_stage: TicketWorkflowStage;
    created_at: string;
    due_date: string;
  }>;
  members: Array<{ company_id: string; user_id: string; full_name: string }>;
  companies: Array<{ id: string; name: string }>;
  searchParams: { week?: string; ganttStatus?: string; ganttSort?: string; ganttView?: string };
}

function stageLabel(workflowStage: TicketWorkflowStage) {
  if (workflowStage === "NEW") return "New";
  if (workflowStage === "ANALYSIS") return "Analysis";
  if (workflowStage === "RESEARCH") return "Research";
  if (workflowStage === "SUPPORT") return "Support";
  if (workflowStage === "DESIGN") return "Design";
  if (workflowStage === "BUG") return "Bug";
  if (workflowStage === "PR_REVIEW") return "PR Review";
  if (workflowStage === "QA") return "QA";
  if (workflowStage === "ADMIN") return "Admin";
  if (workflowStage === "MEETING") return "Meeting";
  return "DEV";
}

function statusTone(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE") {
  if (status === "DONE") return "success" as const;
  if (status === "BLOCKED") return "danger" as const;
  if (status === "ACTIVE") return "info" as const;
  return "neutral" as const;
}

function priorityTone(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  if (priority === "LOW") return "neutral" as const;
  return "info" as const;
}

function timelineBarColor(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE") {
  if (status === "DONE") return "#059669";
  if (status === "BLOCKED") return "#dc2626";
  if (status === "ACTIVE") return "#2563eb";
  return "#64748b";
}

type GanttStatusFilter = "ALL" | "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";
type GanttSortOption = "CREATED_ASC" | "CREATED_DESC";
type GanttViewOption = "CURRENT" | "FULL" | "30D";

function normalizeWeek(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function formatWeekParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildCalendarHref(input: {
  week: Date;
  ganttStatus: GanttStatusFilter;
  ganttSort: GanttSortOption;
  ganttView: GanttViewOption;
}) {
  const params = new URLSearchParams();
  params.set("week", formatWeekParam(input.week));
  params.set("ganttStatus", input.ganttStatus);
  params.set("ganttSort", input.ganttSort);
  params.set("ganttView", input.ganttView);
  return `/calendar?${params.toString()}`;
}

export function CalendarClient({
  auth,
  meetings,
  tickets,
  members,
  companies,
  searchParams,
}: CalendarClientProps) {
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const router = useRouter();

  const params = searchParams;
  const baseWeek = startOfWeek(normalizeWeek(params.week), { weekStartsOn: 1 });
  const ganttStatus = (params.ganttStatus?.toUpperCase() as GanttStatusFilter) || "ACTIVE";
  const ganttSort = (params.ganttSort?.toUpperCase() as GanttSortOption) || "CREATED_ASC";
  const ganttView = (params.ganttView?.toUpperCase() as GanttViewOption) || "CURRENT";
  const nextWeekStart = addDays(baseWeek, 7);
  const prevWeekStart = addDays(baseWeek, -7);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(baseWeek, index));
  const weekDayKeys = weekDays.map((day) => format(day, "yyyy-MM-dd"));

  // Allow any active company member to create events
  const canCreateEvents =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) => membership.company_id === auth.activeCompanyId && membership.is_active
    );

  const grouped = meetings.reduce<Record<string, typeof meetings>>((acc, meeting) => {
    const key = format(new Date(meeting.starts_at), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(meeting);
    return acc;
  }, {});

  const ticketDueGrouped = tickets.reduce<Record<string, typeof tickets>>((acc, ticket) => {
    const key = format(new Date(`${ticket.due_date}T00:00:00`), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(ticket);
    return acc;
  }, {});

  const weekHasItems = weekDayKeys.some(
    (key) => (grouped[key]?.length ?? 0) > 0 || (ticketDueGrouped[key]?.length ?? 0) > 0
  );

  // Gantt timeline logic
  const timelineBaseTickets = tickets
    .filter((ticket) => ganttStatus === "ALL" || ticket.status === ganttStatus)
    .sort((a, b) => {
      const firstDate = new Date(a.created_at).getTime();
      const secondDate = new Date(b.created_at).getTime();
      return ganttSort === "CREATED_ASC" ? firstDate - secondDate : secondDate - firstDate;
    });

  const fullStart =
    timelineBaseTickets.length > 0
      ? startOfDay(
          timelineBaseTickets.reduce((earliest, ticket) => {
            const createdAt = new Date(ticket.created_at);
            return createdAt < earliest ? createdAt : earliest;
          }, new Date(timelineBaseTickets[0].created_at))
        )
      : startOfDay(new Date());

  const fullEnd =
    timelineBaseTickets.length > 0
      ? startOfDay(
          timelineBaseTickets.reduce(
            (latest, ticket) => {
              const dueAt = new Date(`${ticket.due_date}T00:00:00`);
              return dueAt > latest ? dueAt : latest;
            },
            new Date(`${timelineBaseTickets[0].due_date}T00:00:00`)
          )
        )
      : addDays(fullStart, 20);

  const monthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const timelineStart =
    ganttView === "30D"
      ? addDays(startOfDay(new Date()), -7)
      : ganttView === "CURRENT"
        ? monthStart
        : fullStart;
  const timelineEnd = ganttView === "30D" ? addDays(timelineStart, 29) : fullEnd;

  const hasHistoricalTickets =
    ganttView === "CURRENT" &&
    timelineBaseTickets.some((ticket) => startOfDay(new Date(ticket.created_at)) < monthStart);

  const timelineWindowDays = Math.max(differenceInCalendarDays(timelineEnd, timelineStart) + 1, 1);

  const timelineToday = startOfDay(new Date());
  const todayOffset = differenceInCalendarDays(timelineToday, timelineStart);
  const todayPercent =
    todayOffset >= 0 && todayOffset < timelineWindowDays
      ? ((todayOffset + 0.5) / timelineWindowDays) * 100
      : null;

  const timelineTickets: Array<{
    id: string;
    title: string;
    status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    created_at: string;
    due_date: string;
    leftPercent: number;
    widthPercent: number;
  }> = timelineBaseTickets
    .map((ticket: (typeof timelineBaseTickets)[number]) => {
      const createdAt = startOfDay(new Date(ticket.created_at));
      const dueAt = startOfDay(new Date(`${ticket.due_date}T00:00:00`));
      const boundedStart = createdAt < timelineStart ? timelineStart : createdAt;
      const boundedEnd = dueAt > timelineEnd ? timelineEnd : dueAt;

      if (boundedEnd < timelineStart || boundedStart > timelineEnd) return null;

      const left = differenceInCalendarDays(boundedStart, timelineStart);
      const span = Math.max(differenceInCalendarDays(boundedEnd, boundedStart) + 1, 1);
      const unitPercent = 100 / timelineWindowDays;

      return {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        due_date: ticket.due_date,
        leftPercent: left * unitPercent,
        widthPercent: Math.max(span * unitPercent, unitPercent),
      };
    })
    .filter((ticket): ticket is (typeof timelineTickets)[number] => Boolean(ticket));

  const editingEvent = editEventId ? meetings.find((m) => m.id === editEventId) : null;

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
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Create Event
              </h3>
              <p className="text-xs text-slate-500">Open a focused modal to schedule meetings.</p>
            </div>
            <CreateEventModal
              companies={companies.map((company) => ({ id: company.id, name: company.name }))}
              members={members}
              defaultCompanyId={auth.activeCompanyId ?? undefined}
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Weekly schedule
            </p>
            <p className="text-sm text-slate-600">
              {format(weekDays[0], "MMM dd")} –{" "}
              {format(weekDays[weekDays.length - 1], "MMM dd, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?week=${formatWeekParam(prevWeekStart)}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ← Previous week
            </Link>
            <Link
              href={`/calendar?week=${formatWeekParam(nextWeekStart)}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Next week →
            </Link>
          </div>
        </div>

        {!weekHasItems ? (
          <p className="text-sm text-slate-500">No meetings or due dates in esta semana.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {weekDays.map((day, index) => {
              const key = weekDayKeys[index];
              const meetingsOfDay = grouped[key] ?? [];
              const ticketsOfDay = ticketDueGrouped[key] ?? [];
              const hasContent = meetingsOfDay.length > 0 || ticketsOfDay.length > 0;

              return (
                <article key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {format(day, "EEEE")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {format(day, "MMM dd")}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-slate-400">
                      {format(day, "yyyy-MM-dd")}
                    </p>
                  </div>

                  {!hasContent ? (
                    <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                      No events.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {meetingsOfDay.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="rounded-md border border-slate-200 bg-white p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {meeting.title}
                              </p>
                              <p className="text-xs text-slate-600">
                                {format(new Date(meeting.starts_at), "HH:mm")} -{" "}
                                {format(new Date(meeting.ends_at), "HH:mm")}
                              </p>
                              <p className="text-xs text-slate-500">
                                Participants: {meeting.participants.length}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setEditEventId(meeting.id)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteEventId(meeting.id)}
                                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {ticketsOfDay.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-md border border-blue-200 bg-blue-50/50 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{ticket.title}</p>
                            <div className="flex items-center gap-1">
                              <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
                              <StatusBadge
                                label={ticket.priority}
                                tone={priorityTone(ticket.priority)}
                              />
                              <StatusBadge
                                label={stageLabel(ticket.workflow_stage)}
                                tone="neutral"
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Ticket due date milestone</p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Ticket Timeline (Gantt)
            </h3>
            <p className="text-xs text-slate-500">
              {format(timelineStart, "yyyy-MM-dd")} → {format(timelineEnd, "yyyy-MM-dd")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["ALL", "ACTIVE", "BLOCKED", "DONE"].map((statusOption) => (
              <Link
                key={statusOption}
                href={buildCalendarHref({
                  week: baseWeek,
                  ganttStatus: statusOption as GanttStatusFilter,
                  ganttSort,
                  ganttView,
                })}
                className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                  ganttStatus === statusOption
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {statusOption}
              </Link>
            ))}

            <Link
              href={buildCalendarHref({
                week: baseWeek,
                ganttStatus,
                ganttSort: ganttSort === "CREATED_ASC" ? "CREATED_DESC" : "CREATED_ASC",
                ganttView,
              })}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sort: {ganttSort === "CREATED_ASC" ? "Oldest" : "Newest"}
            </Link>

            {(["CURRENT", "30D", "FULL"] as GanttViewOption[]).map((v) => (
              <Link
                key={v}
                href={buildCalendarHref({ week: baseWeek, ganttStatus, ganttSort, ganttView: v })}
                className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                  ganttView === v
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {v === "CURRENT" ? "This month" : v === "30D" ? "30 days" : "Full history"}
              </Link>
            ))}
          </div>
        </div>

        {hasHistoricalTickets && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">
              Some tickets from previous months are hidden in this view.
            </p>
            <Link
              href={buildCalendarHref({
                week: baseWeek,
                ganttStatus,
                ganttSort,
                ganttView: "FULL",
              })}
              className="shrink-0 rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              View full history
            </Link>
          </div>
        )}

        {timelineTickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active tickets with due dates.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div
              className="grid items-center gap-x-3"
              style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Ticket
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {format(timelineStart, "MMM dd")} → {format(timelineEnd, "MMM dd, yyyy")}
              </p>
            </div>

            {timelineTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="grid items-center gap-x-3"
                style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)" }}
              >
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-slate-800">{ticket.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {format(new Date(ticket.created_at), "MMM dd")} →{" "}
                    {format(new Date(`${ticket.due_date}T00:00:00`), "MMM dd")} · {ticket.priority}
                  </p>
                  {ticket.status === "BLOCKED" && (
                    <p className="text-[11px] font-semibold text-rose-600">Blocked</p>
                  )}
                </div>

                <div className="relative h-8 rounded-md border border-slate-200 bg-slate-50">
                  {todayPercent !== null && (
                    <div
                      className="absolute bottom-1 top-1 w-px bg-slate-400/80"
                      style={{ left: `${todayPercent}%` }}
                      title="Today"
                    />
                  )}
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

      {editingEvent && (
        <EditEventModal
          companies={companies.map((company) => ({ id: company.id, name: company.name }))}
          members={members}
          eventId={editingEvent.id}
          initialData={{
            companyId: editingEvent.company_id,
            title: editingEvent.title,
            date: format(new Date(editingEvent.starts_at), "yyyy-MM-dd"),
            startsAtTime: format(new Date(editingEvent.starts_at), "HH:mm"),
            endsAtTime: format(new Date(editingEvent.ends_at), "HH:mm"),
            participantIds: editingEvent.participants,
          }}
          onClose={() => setEditEventId(null)}
        />
      )}

      {deleteEventId && (
        <DeleteConfirmationModal eventId={deleteEventId} onClose={() => setDeleteEventId(null)} />
      )}
    </div>
  );
}

interface DeleteConfirmationModalProps {
  eventId: string;
  onClose: () => void;
}

const initialDeleteState: DeleteCalendarEventState = {};

function DeleteConfirmationModal({ eventId, onClose }: DeleteConfirmationModalProps) {
  const [state, formAction] = useActionState<DeleteCalendarEventState, FormData>(
    deleteCalendarEventAction,
    initialDeleteState
  );

  // Close modal on successful delete (no error and state changed from initial)
  useEffect(() => {
    if (state && !state.error && state !== initialDeleteState) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <form
        action={formAction}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planning</p>
          <h3 className="text-lg font-semibold text-slate-900">Delete Event</h3>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this event? This action cannot be undone.
          </p>
        </div>

        <input type="hidden" name="eventId" value={eventId} />

        {state.error && (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
