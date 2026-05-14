import { getAuthContext } from "@/lib/auth/session";
import { getCompaniesForUser, getTeams, getTeamWorkload } from "@/lib/data/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createTeamAction, deleteTeamAction, updateTeamAction } from "./actions";
import { TeamBoard } from "./team-board";

interface InactiveMemberInfo {
  userId: string;
  fullName: string;
  hasTicketHistory: boolean;
}

export default async function TeamPage() {
  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = auth.activeCompanyId ?? companies[0]?.id ?? null;
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const isCompanyAdmin =
    auth.isSuperAdmin ||
    auth.memberships.some((m) => m.company_id === selectedCompanyId && m.role === "COMPANY_ADMIN");

  const canManageTeams =
    isCompanyAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId && membership.role === "MANAGE_TEAM"
    );

  const [teams, members] = await Promise.all([
    getTeams(auth, selectedCompanyId),
    getTeamWorkload(auth, selectedCompanyId),
  ]);

  const supabase = await createSupabaseServerClient();
  let teamMemberRows: Array<{ team_id: string; user_id: string }> = [];
  let inactiveMembers: InactiveMemberInfo[] = [];

  if (selectedCompanyId) {
    const [activeResult, inactiveResult] = await Promise.all([
      supabase
        .from("team_members")
        .select("team_id, user_id")
        .eq("company_id", selectedCompanyId)
        .eq("is_active", true),
      supabase
        .from("company_memberships")
        .select("user_id, user_profiles!inner(id, full_name)")
        .eq("company_id", selectedCompanyId)
        .eq("is_active", false),
    ]);

    if (activeResult.error) {
      throw new Error(`Failed to fetch team members: ${activeResult.error.message}`);
    }

    teamMemberRows = activeResult.data ?? [];

    if (!inactiveResult.error && inactiveResult.data) {
      const inactiveUserIds = inactiveResult.data.map((row) => {
        const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
        return {
          userId: row.user_id,
          fullName: (profile as { full_name: string })?.full_name ?? "Unknown",
        };
      });

      const { data: ticketHistoryData } = await supabase
        .from("tickets")
        .select("assigned_to, created_by")
        .eq("company_id", selectedCompanyId)
        .in(
          "assigned_to",
          inactiveUserIds.map((u) => u.userId)
        );

      const usersWithHistory = new Set(
        (ticketHistoryData ?? []).flatMap((t) => [t.assigned_to, t.created_by].filter(Boolean))
      );

      inactiveMembers = inactiveUserIds.map((u) => ({
        ...u,
        hasTicketHistory: usersWithHistory.has(u.userId),
      }));
    }
  }

  // Build serializable membersByTeam record (plain object for client component)
  const membersByTeam: Record<string, string[]> = {};
  for (const row of teamMemberRows) {
    if (!membersByTeam[row.team_id]) membersByTeam[row.team_id] = [];
    membersByTeam[row.team_id].push(row.user_id);
  }

  const memberInfoMap: Record<string, (typeof members)[0]> = Object.fromEntries(
    members.map((m) => [m.userId, m])
  );

  const allAssignedUserIds = new Set(teamMemberRows.map((row) => row.user_id));
  const unassignedToAnyTeam = members.filter((m) => !allAssignedUserIds.has(m.userId));

  const activeMembersList = members.map((m) => ({ userId: m.userId, fullName: m.fullName }));

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

      {/* Team name edit / delete controls — server forms only for MANAGE_TEAM/ADMIN */}
      {canManageTeams && teams.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => (
            <div
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
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Save
                  </button>
                </div>
              </form>
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
            </div>
          ))}
        </section>
      )}

      {/* Interactive board with drag & drop */}
      {selectedCompanyId && (
        <TeamBoard
          companyId={selectedCompanyId}
          companyName={selectedCompany?.name ?? "this company"}
          teams={teams}
          membersByTeam={membersByTeam}
          memberInfoMap={memberInfoMap}
          unassignedToAnyTeam={unassignedToAnyTeam}
          activeMembersList={activeMembersList}
          currentUserId={auth.user.id}
          isCompanyAdmin={isCompanyAdmin}
          canManageTeams={canManageTeams}
        />
      )}

      {/* Inactive members section */}
      {inactiveMembers.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Desvinculados
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Former members no longer linked to this company.
          </p>
          <ul className="mt-3 space-y-1">
            {inactiveMembers
              .filter((m) => m.hasTicketHistory)
              .map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between text-sm text-slate-400"
                >
                  <span className="line-through">{member.fullName}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                    Desactivado
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
