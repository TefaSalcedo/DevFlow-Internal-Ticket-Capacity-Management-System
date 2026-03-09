import { getAuthContext } from "@/lib/auth/session";
import {
  getBoards,
  getCompaniesForUser,
  getProjects,
  getTeams,
  getTeamWorkload,
} from "@/lib/data/queries";

import { TicketForm } from "./ticket-form";

interface NewTicketPageProps {
  searchParams: Promise<{
    companyId?: string;
    teamId?: string;
    boardId?: string;
    parentTicketId?: string;
  }>;
}

function resolveOptionalId<T extends { id: string }>(preferredId: string | undefined, collection: T[]) {
  if (!preferredId) {
    return undefined;
  }

  return collection.some((item) => item.id === preferredId) ? preferredId : undefined;
}

export default async function NewTicketPage({ searchParams }: NewTicketPageProps) {
  const params = await searchParams;
  const auth = await getAuthContext();
  const [companies, projects, members] = await Promise.all([
    getCompaniesForUser(auth),
    getProjects(auth),
    getTeamWorkload(auth),
  ]);

  const defaultCompanyId =
    resolveOptionalId(params.companyId, companies) ?? auth.activeCompanyId ?? companies[0]?.id ?? undefined;
  const teamsByCompany = await Promise.all(
    companies.map((company) => {
      return getTeams(auth, company.id);
    })
  );
  const teams = teamsByCompany.flat();
  const fallbackTeamId = teams.find((team) => team.company_id === defaultCompanyId)?.id;
  const defaultTeamId =
    resolveOptionalId(
      params.teamId,
      teams.filter((team) => team.company_id === defaultCompanyId)
    ) ?? fallbackTeamId;

  const boardsByTeam = await Promise.all(
    teams.map((team) => {
      return getBoards(auth, {
        companyId: team.company_id,
        teamId: team.id,
      });
    })
  );
  const boards = boardsByTeam.flat();
  const fallbackBoardId = boards.find((board) => board.team_id === defaultTeamId)?.id;
  const defaultBoardId =
    resolveOptionalId(
      params.boardId,
      boards.filter((board) => board.team_id === defaultTeamId)
    ) ?? fallbackBoardId;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ticketing
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create New Ticket</h2>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <TicketForm
          companies={companies.map((company) => ({ id: company.id, name: company.name }))}
          projects={projects.map((project) => ({
            id: project.id,
            code: project.code,
            name: project.name,
          }))}
          members={members.map((member) => ({ userId: member.userId, fullName: member.fullName }))}
          teams={teams.map((team) => ({
            id: team.id,
            companyId: team.company_id,
            name: team.name,
          }))}
          boards={boards.map((board) => ({
            id: board.id,
            companyId: board.company_id,
            teamId: board.team_id,
            name: board.name,
          }))}
          defaultCompanyId={defaultCompanyId}
          defaultTeamId={defaultTeamId}
          defaultBoardId={defaultBoardId}
          defaultParentTicketId={params.parentTicketId}
        />
      </section>
    </div>
  );
}
