import { addDays, format, startOfWeek } from "date-fns";
import Link from "next/link";

import { getAuthContext } from "@/lib/auth/session";
import { getTeamWeeklyActivitySnapshot } from "@/lib/data/queries";
import type { TeamActivityDayBreakdown } from "@/lib/types/domain";

function formatFieldName(fieldName: string | null) {
  if (!fieldName) {
    return "Field";
  }

  if (fieldName === "workflow_stage") {
    return "Workflow stage";
  }

  return fieldName.replaceAll("_", " ");
}

function DayBreakdownSection({ breakdown }: { breakdown: TeamActivityDayBreakdown[] }) {
  const totalHours = breakdown.reduce((acc, day) => acc + day.hoursWorked, 0);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
        Daily Breakdown (Hours: {totalHours})
      </h4>
      <div className="grid gap-2 sm:grid-cols-5">
        {breakdown.map((day) => (
          <div
            key={day.dayIndex}
            className={`rounded border p-2 text-center ${
              day.hoursWorked > 0 ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-slate-700">{day.dayName}</p>
            <p className="text-lg font-bold text-slate-900">{day.hoursWorked}h</p>
            <div className="mt-1 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Created:</span>
                <span className="font-medium text-blue-600">{day.createdCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Assigned:</span>
                <span className="font-medium text-green-600">{day.assignedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Moves:</span>
                <span className="font-medium text-purple-600">{day.movementCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed activities for days with work */}
      <div className="mt-3 space-y-2">
        {breakdown
          .filter((day) => day.hoursWorked > 0)
          .map((day) => (
            <details key={day.dayIndex} className="rounded border border-slate-200 bg-white p-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                {day.dayName} Details ({day.hoursWorked}h)
              </summary>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                {day.activities.created.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-blue-700">
                      Created ({day.activities.created.length})
                    </p>
                    <ul className="space-y-1 text-xs">
                      {day.activities.created.map((ticket) => (
                        <li key={ticket.ticketId} className="rounded bg-blue-50 p-1">
                          <p className="font-medium text-blue-800">{ticket.title}</p>
                          <p className="text-blue-600">{ticket.status}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {day.activities.assigned.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-green-700">
                      Assigned ({day.activities.assigned.length})
                    </p>
                    <ul className="space-y-1 text-xs">
                      {day.activities.assigned.map((ticket) => (
                        <li key={ticket.ticketId} className="rounded bg-green-50 p-1">
                          <p className="font-medium text-green-800">{ticket.title}</p>
                          <p className="text-green-600">{ticket.status}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {day.activities.movements.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-purple-700">
                      Movements ({day.activities.movements.length})
                    </p>
                    <ul className="space-y-1 text-xs">
                      {day.activities.movements.map((movement) => (
                        <li key={movement.historyId} className="rounded bg-purple-50 p-1">
                          <p className="font-medium text-purple-800">{movement.ticketTitle}</p>
                          <p className="text-purple-600">
                            {formatFieldName(movement.fieldName)}: {movement.fromValue ?? "-"} →{" "}
                            {movement.toValue ?? "-"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
      </div>
    </div>
  );
}

interface TeamActivityPageProps {
  searchParams: Promise<{
    week?: string;
  }>;
}

function normalizeWeek(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function formatWeekParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export default async function TeamActivityPage({ searchParams }: TeamActivityPageProps) {
  const params = await searchParams;
  const auth = await getAuthContext();
  const activeCompanyId = auth.activeCompanyId;
  const baseWeek = startOfWeek(normalizeWeek(params.week), { weekStartsOn: 1 });
  const prevWeekStart = addDays(baseWeek, -7);
  const nextWeekStart = addDays(baseWeek, 7);
  const canView = auth.memberships.some(
    (membership) => membership.company_id === activeCompanyId && membership.role === "MANAGE_TEAM"
  );

  if (!canView) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        This page is only available for MANAGE_TEAM users in the active company.
      </div>
    );
  }

  const snapshot = await getTeamWeeklyActivitySnapshot(auth, activeCompanyId, baseWeek);
  const weekStartLabel = format(new Date(snapshot.weekStart), "PPP");
  const weekEndLabel = format(new Date(snapshot.weekEnd), "PPP");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Management
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Team Weekly Activity
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Week: {weekStartLabel} - {weekEndLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/team-activity?week=${formatWeekParam(prevWeekStart)}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Previous week
          </Link>
          <Link
            href={`/team-activity?week=${formatWeekParam(nextWeekStart)}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Next week →
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Created this week</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.totals.createdTickets}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Assigned</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.totals.assignedTickets}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Movements</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.totals.movements}</p>
        </article>
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-rose-700">Critical tickets</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">
            {snapshot.totals.criticalAssigned}
          </p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Avg inactive days</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">
            {snapshot.totals.averageInactiveDays}
          </p>
        </article>
      </section>

      <section className="space-y-3">
        {snapshot.members.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
            No active members found in your managed teams.
          </article>
        ) : (
          snapshot.members.map((member) => (
            <article
              key={member.userId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{member.fullName}</h3>
                  <p className="text-xs text-slate-500">
                    Productivity ratio: {member.productivityRatio} · Capacity{" "}
                    {member.weeklyCapacity}h
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <p>
                  ✅ Tickets created: <span className="font-semibold">{member.createdCount}</span>
                </p>
                <p>
                  📋 Assigned: <span className="font-semibold">{member.assignedCount}</span> (
                  <span className="font-semibold text-rose-700">
                    {member.criticalAssignedCount} critical
                  </span>
                  )
                </p>
                <p>
                  🔄 Movements: <span className="font-semibold">{member.movementCount}</span>
                </p>
                <p>
                  ⏰ Avg inactive:{" "}
                  <span className="font-semibold">{member.averageInactiveDays}</span> days
                </p>
              </div>

              {/* Daily breakdown section */}
              <DayBreakdownSection breakdown={member.dailyBreakdown} />

              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  View member details
                </summary>

                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created tickets ({member.createdCount})
                    </p>
                    <ul className="space-y-2 text-xs">
                      {member.createdTickets.length === 0 ? (
                        <li className="text-slate-500">
                          No tickets created in this selected week.
                        </li>
                      ) : (
                        member.createdTickets.map((ticket) => (
                          <li
                            key={`created-${ticket.ticketId}`}
                            className="rounded border border-slate-200 bg-white p-2"
                          >
                            <p className="font-semibold text-slate-800">{ticket.title}</p>
                            <p className="text-slate-600">
                              {ticket.status} · {ticket.workflowStage} ·{" "}
                              {format(new Date(ticket.createdAt), "PPp")}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned tickets ({member.assignedCount})
                    </p>
                    <ul className="space-y-2 text-xs">
                      {member.assignedTickets.length === 0 ? (
                        <li className="text-slate-500">No assigned tickets.</li>
                      ) : (
                        member.assignedTickets.map((ticket) => (
                          <li
                            key={`assigned-${ticket.ticketId}`}
                            className={`rounded border bg-white p-2 ${
                              ticket.isCritical ? "border-rose-300" : "border-slate-200"
                            }`}
                          >
                            <p className="font-semibold text-slate-800">{ticket.title}</p>
                            <p className="text-slate-600">
                              {ticket.status} · {ticket.workflowStage} · inactive{" "}
                              {ticket.inactiveDays} days
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Movements ({member.movementCount})
                    </p>
                    <ul className="space-y-2 text-xs">
                      {member.movements.length === 0 ? (
                        <li className="text-slate-500">
                          No status/workflow changes in this selected week.
                        </li>
                      ) : (
                        member.movements.map((movement) => (
                          <li
                            key={`movement-${movement.historyId}`}
                            className="rounded border border-slate-200 bg-white p-2"
                          >
                            <p className="font-semibold text-slate-800">{movement.ticketTitle}</p>
                            <p className="text-slate-600">
                              {formatFieldName(movement.fieldName)}: {movement.fromValue ?? "-"} →{" "}
                              {movement.toValue ?? "-"}
                            </p>
                            <p className="text-slate-500">
                              {format(new Date(movement.createdAt), "PPp")}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </details>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
