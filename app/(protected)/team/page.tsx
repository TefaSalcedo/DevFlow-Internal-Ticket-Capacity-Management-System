import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getTeamOptions, getTeamWorkload } from "@/lib/data/queries";

interface TeamPageProps {
  searchParams: Promise<{
    teamId?: string;
  }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const requestedTeamId = typeof params.teamId === "string" ? params.teamId : undefined;
  const auth = await getAuthContext();
  const teams = await getTeamOptions(auth);
  const selectedTeamId = teams.some((team) => team.id === requestedTeamId)
    ? requestedTeamId
    : undefined;
  const members = await getTeamWorkload(auth, undefined, selectedTeamId);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Capacity</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Team Workload</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scope:{" "}
          <span className="font-semibold">
            {teams.find((team) => team.id === selectedTeamId)?.name ?? "All teams"}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/team"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              !selectedTeamId
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            All teams
          </Link>
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/team?teamId=${team.id}`}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                selectedTeamId === team.id
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {team.name}
            </Link>
          ))}
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Capacity</th>
                <th className="py-2 pr-3">Assigned</th>
                <th className="py-2 pr-3">Meetings</th>
                <th className="py-2 pr-3">Remaining</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-slate-500">
                    No active team members found for this company.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const consumed = member.assignedHours + member.meetingHours;
                  const overloaded = member.remaining < 0;

                  return (
                    <tr key={member.userId}>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-900">{member.fullName}</p>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{member.role}</td>
                      <td className="py-3 pr-3 text-slate-600">{member.weeklyCapacity}h</td>
                      <td className="py-3 pr-3 text-slate-600">
                        {member.assignedHours.toFixed(1)}h
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {member.meetingHours.toFixed(1)}h
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{member.remaining.toFixed(1)}h</td>
                      <td className="py-3">
                        {overloaded ? (
                          <StatusBadge label="Overload" tone="danger" />
                        ) : consumed / member.weeklyCapacity > 0.8 ? (
                          <StatusBadge label="Near cap" tone="warning" />
                        ) : (
                          <StatusBadge label="Healthy" tone="success" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {members.map((member) => (
          <article
            key={`${member.userId}-progress`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{member.fullName}</h3>
              <p className="text-xs text-slate-600">
                {(member.assignedHours + member.meetingHours).toFixed(1)}/{member.weeklyCapacity}h
              </p>
            </div>
            <ProgressBar
              value={member.assignedHours + member.meetingHours}
              max={member.weeklyCapacity}
            />
            {member.remaining < 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-rose-600">
                <AlertTriangle className="size-3.5" />
                Exceeds weekly capacity by {Math.abs(member.remaining).toFixed(1)}h
              </p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
