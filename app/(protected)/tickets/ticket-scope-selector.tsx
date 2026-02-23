"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface ScopeOption {
  id: string;
  name: string;
}

interface TicketScopeSelectorProps {
  companies: ScopeOption[];
  teams: ScopeOption[];
  boards: ScopeOption[];
  selectedCompanyId: string | null;
  selectedTeamId: string | null;
  selectedBoardId: string | null;
  doneMonth: string;
  allowUnscoped?: boolean;
  basePath?: string;
}

function buildTicketsHref(input: {
  basePath: string;
  doneMonth: string;
  companyId?: string | null;
  teamId?: string | null;
  boardId?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("doneMonth", input.doneMonth);

  if (input.companyId) {
    params.set("company", input.companyId);
  }

  if (input.teamId) {
    params.set("team", input.teamId);
  }

  if (input.boardId) {
    params.set("board", input.boardId);
  }

  return `${input.basePath}?${params.toString()}`;
}

export function TicketScopeSelector({
  companies,
  teams,
  boards,
  selectedCompanyId,
  selectedTeamId,
  selectedBoardId,
  doneMonth,
  allowUnscoped = false,
  basePath = "/tickets",
}: TicketScopeSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <label
            htmlFor="ticket-company-scope"
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
          >
            Company
          </label>
          <select
            id="ticket-company-scope"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            value={selectedCompanyId ?? ""}
            onChange={(event) => {
              const nextCompanyId = event.target.value || null;

              startTransition(() => {
                router.replace(
                  buildTicketsHref({
                    basePath,
                    doneMonth,
                    companyId: nextCompanyId,
                  })
                );
              });
            }}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-44 flex-1">
          <label
            htmlFor="ticket-team-scope"
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
          >
            Team
          </label>
          <select
            id="ticket-team-scope"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            value={selectedTeamId ?? ""}
            onChange={(event) => {
              const nextTeamId = event.target.value || null;

              startTransition(() => {
                router.replace(
                  buildTicketsHref({
                    basePath,
                    doneMonth,
                    companyId: selectedCompanyId,
                    teamId: nextTeamId,
                  })
                );
              });
            }}
          >
            {allowUnscoped && <option value="">All teams</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-44 flex-1">
          <label
            htmlFor="ticket-board-scope"
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
          >
            Board
          </label>
          <select
            id="ticket-board-scope"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            value={selectedBoardId ?? ""}
            onChange={(event) => {
              const nextBoardId = event.target.value || null;

              startTransition(() => {
                router.replace(
                  buildTicketsHref({
                    basePath,
                    doneMonth,
                    companyId: selectedCompanyId,
                    teamId: selectedTeamId,
                    boardId: nextBoardId,
                  })
                );
              });
            }}
          >
            {allowUnscoped && <option value="">All boards</option>}
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && (
        <p className="mt-2 text-xs font-medium text-blue-700">Updating board scope...</p>
      )}
    </section>
  );
}
