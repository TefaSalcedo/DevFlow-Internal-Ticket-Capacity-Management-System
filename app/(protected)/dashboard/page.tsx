import { AlertTriangle, Clock3, FolderKanban, Gauge, Users } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/data/queries";

export default async function DashboardPage() {
  const auth = await getAuthContext();
  const snapshot = await getDashboardSnapshot(auth);

  const capacityPercentage =
    snapshot.weeklyCapacity <= 0
      ? 0
      : Math.round((snapshot.weeklyAssigned / snapshot.weeklyCapacity) * 100);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Total Tickets
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{snapshot.totalTickets}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
            <FolderKanban className="size-3.5" />
            Active pipeline health
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Urgent Tickets
          </p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {snapshot.urgentTickets.length}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-rose-600">
            <AlertTriangle className="size-3.5" />
            Requires immediate action
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Hours This Week
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {snapshot.weeklyAssigned}/{snapshot.weeklyCapacity}
          </p>
          <div className="mt-3">
            <ProgressBar value={snapshot.weeklyAssigned} max={snapshot.weeklyCapacity} />
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Team Capacity
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{capacityPercentage}%</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
            <Gauge className="size-3.5" />
            Workload allocation
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Ticket Status Overview</h3>
            <StatusBadge label="Live" tone="info" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Backlog</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {snapshot.statusCount.BACKLOG}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs uppercase text-blue-600">Active</p>
              <p className="mt-1 text-2xl font-semibold text-blue-700">
                {snapshot.statusCount.ACTIVE}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs uppercase text-amber-600">Blocked</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">
                {snapshot.statusCount.BLOCKED}
              </p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-xs uppercase text-rose-600">Bug</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">
                {snapshot.statusCount.BUG}
              </p>
            </div>
            <div className="rounded-lg bg-fuchsia-50 p-3">
              <p className="text-xs uppercase text-fuchsia-600">Design</p>
              <p className="mt-1 text-2xl font-semibold text-fuchsia-700">
                {snapshot.statusCount.DESIGN}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs uppercase text-emerald-600">Done</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {snapshot.statusCount.DONE}
              </p>
            </div>
          </div>

          <h4 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Urgent Priority Tickets
          </h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Hours</th>
                  <th className="py-2">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.recentUrgent.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-slate-500">
                      No urgent tickets in scope.
                    </td>
                  </tr>
                ) : (
                  snapshot.recentUrgent.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="py-3 pr-3 font-medium text-slate-800">{ticket.title}</td>
                      <td className="py-3 pr-3 text-slate-600">{ticket.estimated_hours}h</td>
                      <td className="py-3 text-slate-600">{ticket.due_date ?? "No due date"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Team Workload</h3>
            <div className="mt-4 space-y-4">
              {snapshot.teamData.slice(0, 4).map((member) => (
                <div key={member.userId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium text-slate-800">{member.fullName}</p>
                    <p className="text-slate-600">
                      {Math.round(member.assignedHours + member.meetingHours)}/
                      {member.weeklyCapacity}h
                    </p>
                  </div>
                  <ProgressBar
                    value={member.assignedHours + member.meetingHours}
                    max={member.weeklyCapacity}
                  />
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Today's Meetings</h3>
            <div className="mt-4 space-y-3">
              {snapshot.meetingsToday.length === 0 ? (
                <p className="text-sm text-slate-500">No meetings scheduled today.</p>
              ) : (
                snapshot.meetingsToday.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                      <Clock3 className="size-3.5" />
                      {new Date(meeting.starts_at).toLocaleTimeString()} -{" "}
                      {new Date(meeting.ends_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="size-4.5" /> Capacity Alert
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {snapshot.teamData.filter((member) => member.remaining < 0).length} overloaded members
              detected.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
