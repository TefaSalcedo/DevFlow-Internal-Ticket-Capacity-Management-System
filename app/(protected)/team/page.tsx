import { getAuthContext } from "@/lib/auth/session";
import { getCompaniesForUser, getTeams, getTeamWorkload } from "@/lib/data/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  assignTeamMemberAction,
  createTeamAction,
  deleteTeamAction,
  removeTeamMemberAction,
  updateTeamAction,
} from "./actions";

export default async function TeamPage() {
  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = auth.activeCompanyId ?? companies[0]?.id ?? null;

  const canManageTeams =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId && membership.role === "COMPANY_ADMIN"
    );

  const [teams, members] = await Promise.all([
    getTeams(auth, selectedCompanyId),
    getTeamWorkload(auth, selectedCompanyId),
  ]);

  const supabase = await createSupabaseServerClient();
  let teamMemberRows: Array<{
    team_id: string;
    user_id: string;
  }> = [];

  if (selectedCompanyId) {
    const { data, error } = await supabase
      .from("team_members")
      .select("team_id, user_id")
      .eq("company_id", selectedCompanyId)
      .eq("is_active", true);

    if (error) {
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }

    teamMemberRows = data ?? [];
  }

  const membersByTeam = new Map<string, string[]>(
    (teamMemberRows ?? []).reduce<Array<[string, string[]]>>((acc, row) => {
      const existing = acc.find((entry) => entry[0] === row.team_id);
      if (existing) {
        existing[1].push(row.user_id);
      } else {
        acc.push([row.team_id, [row.user_id]]);
      }
      return acc;
    }, [])
  );

  const memberInfoMap = new Map(members.map((member) => [member.userId, member]));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">People</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Teams</h2>
        <p className="mt-1 text-sm text-slate-600">Manage company teams and team memberships.</p>
      </header>

      {canManageTeams && selectedCompanyId && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Create team
          </h3>
          <form action={createTeamAction} className="mt-3 flex gap-2">
            <input type="hidden" name="companyId" value={selectedCompanyId} />
            <input
              name="name"
              placeholder="Development"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </form>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {teams.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 lg:col-span-2">
            No teams found. You can work with an "unassigned team" flow until your company creates
            teams.
          </article>
        ) : (
          teams.map((team) => {
            const teamMemberIds = membersByTeam.get(team.id) ?? [];
            const unassignedMembers = members.filter(
              (member) => !teamMemberIds.includes(member.userId)
            );

            return (
              <article
                key={team.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <form action={updateTeamAction} className="space-y-2">
                  <input type="hidden" name="companyId" value={team.company_id} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <label
                    htmlFor={`team-name-${team.id}`}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Team name
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`team-name-${team.id}`}
                      name="name"
                      defaultValue={team.name}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      required
                      disabled={!canManageTeams}
                    />
                    {canManageTeams && (
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </form>

                {canManageTeams && (
                  <form action={deleteTeamAction} className="mt-2">
                    <input type="hidden" name="companyId" value={team.company_id} />
                    <input type="hidden" name="teamId" value={team.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700"
                    >
                      Delete team
                    </button>
                  </form>
                )}

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Members
                  </p>
                  {teamMemberIds.length === 0 ? (
                    <p className="text-xs text-slate-500">No active members.</p>
                  ) : (
                    <ul className="space-y-1">
                      {teamMemberIds.map((userId) => {
                        const memberInfo = memberInfoMap.get(userId);
                        const isLeader = memberInfo?.role === "MANAGE_TEAM";
                        const memberLabel = memberInfo?.fullName ?? userId;

                        return (
                          <li
                            key={`${team.id}-${userId}`}
                            className="flex items-center justify-between text-sm"
                          >
                            <span
                              className={
                                isLeader ? "font-semibold text-slate-900" : "text-slate-800"
                              }
                            >
                              {memberLabel}
                              {isLeader ? " (Leader)" : ""}
                            </span>
                            {canManageTeams && (
                              <form action={removeTeamMemberAction}>
                                <input type="hidden" name="companyId" value={team.company_id} />
                                <input type="hidden" name="teamId" value={team.id} />
                                <input type="hidden" name="userId" value={userId} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                                >
                                  Remove
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canManageTeams && (
                    <form action={assignTeamMemberAction} className="flex gap-2 pt-2">
                      <input type="hidden" name="companyId" value={team.company_id} />
                      <input type="hidden" name="teamId" value={team.id} />
                      <select
                        name="userId"
                        className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Add member
                        </option>
                        {unassignedMembers.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
                      >
                        Add
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
