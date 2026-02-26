import { getAuthContext } from "@/lib/auth/session";
import { getTeamWorkload } from "@/lib/data/queries";

export default async function TeamPage() {
  const auth = await getAuthContext();
  const members = await getTeamWorkload(auth);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">People</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Team Directory</h2>
        <p className="mt-1 text-sm text-slate-600">Corporate view of active members and roles.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2">Directory status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-slate-500">
                    No active team members found for this company.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.userId}>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{member.fullName}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{member.role}</td>
                    <td className="py-3">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
