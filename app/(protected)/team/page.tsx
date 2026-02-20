import { AlertTriangle } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getTeamWorkload } from "@/lib/data/queries";

export default async function TeamPage() {
  const auth = await getAuthContext();
  const members = await getTeamWorkload(auth);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Capacity</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Team Workload</h2>
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
