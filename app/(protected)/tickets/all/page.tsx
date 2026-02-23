import Link from "next/link";

import { TicketScopeSelector } from "@/app/(protected)/tickets/ticket-scope-selector";
import { getAuthContext } from "@/lib/auth/session";
import {
  getAssignedTicketsForCurrentUser,
  getBoards,
  getCompaniesForUser,
  getTeams,
} from "@/lib/data/queries";
import type { TicketPriority, TicketStatus } from "@/lib/types/domain";

interface TicketsAllPageProps {
  searchParams: Promise<{
    doneMonth?: string;
    company?: string;
    team?: string;
    board?: string;
    status?: string;
    priority?: string;
  }>;
}

const STATUS_OPTIONS: TicketStatus[] = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function normalizeDoneMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolveSelectedId<T extends { id: string }>(
  preferredId: string | undefined,
  collection: T[],
  fallbackId?: string | null
) {
  if (preferredId && collection.some((item) => item.id === preferredId)) {
    return preferredId;
  }

  if (fallbackId && collection.some((item) => item.id === fallbackId)) {
    return fallbackId;
  }

  return collection[0]?.id ?? null;
}

function resolveOptionalId<T extends { id: string }>(
  preferredId: string | undefined,
  collection: T[]
) {
  if (!preferredId) {
    return null;
  }

  return collection.some((item) => item.id === preferredId) ? preferredId : null;
}

function parseStatus(value?: string): TicketStatus | undefined {
  if (!value) {
    return undefined;
  }

  return STATUS_OPTIONS.includes(value as TicketStatus) ? (value as TicketStatus) : undefined;
}

function parsePriority(value?: string): TicketPriority | undefined {
  if (!value) {
    return undefined;
  }

  return PRIORITY_OPTIONS.includes(value as TicketPriority) ? (value as TicketPriority) : undefined;
}

function buildHref(input: {
  basePath: string;
  doneMonth: string;
  companyId?: string | null;
  teamId?: string | null;
  boardId?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
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

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.priority) {
    params.set("priority", input.priority);
  }

  return `${input.basePath}?${params.toString()}`;
}

export default async function TicketsAllPage({ searchParams }: TicketsAllPageProps) {
  const params = await searchParams;
  const doneMonth = normalizeDoneMonth(params.doneMonth);

  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = resolveSelectedId(params.company, companies, auth.activeCompanyId);

  const teams = await getTeams(auth, selectedCompanyId);
  const selectedTeamId = resolveOptionalId(params.team, teams);

  const boards = await getBoards(auth, {
    companyId: selectedCompanyId,
    teamId: selectedTeamId,
  });
  const selectedBoardId = resolveOptionalId(params.board, boards);

  const selectedStatus = parseStatus(params.status);
  const selectedPriority = parsePriority(params.priority);

  const assignedTickets = await getAssignedTicketsForCurrentUser(auth, {
    companyId: selectedCompanyId,
    teamId: selectedTeamId,
    boardId: selectedBoardId,
    status: selectedStatus,
    priority: selectedPriority,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tickets
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">All Tasks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Aggregated assignments across teams and boards for the authenticated user.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({
              basePath: "/tickets",
              doneMonth,
              companyId: selectedCompanyId,
              teamId: selectedTeamId,
              boardId: selectedBoardId,
            })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Board View
          </Link>
          <Link
            href={buildHref({
              basePath: "/tickets/mine",
              doneMonth,
              companyId: selectedCompanyId,
              teamId: selectedTeamId,
              boardId: selectedBoardId,
              status: selectedStatus,
              priority: selectedPriority,
            })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            My Tasks
          </Link>
        </div>
      </header>

      <TicketScopeSelector
        companies={companies.map((company) => ({ id: company.id, name: company.name }))}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
        boards={boards.map((board) => ({ id: board.id, name: board.name }))}
        selectedCompanyId={selectedCompanyId}
        selectedTeamId={selectedTeamId}
        selectedBoardId={selectedBoardId}
        doneMonth={doneMonth}
        allowUnscoped
        basePath="/tickets/all"
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="GET">
          <input type="hidden" name="doneMonth" value={doneMonth} />
          {selectedCompanyId && <input type="hidden" name="company" value={selectedCompanyId} />}
          {selectedTeamId && <input type="hidden" name="team" value={selectedTeamId} />}
          {selectedBoardId && <input type="hidden" name="board" value={selectedBoardId} />}

          <div>
            <label
              htmlFor="all-filter-status"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Status
            </label>
            <select
              id="all-filter-status"
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="all-filter-priority"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Urgency
            </label>
            <select
              id="all-filter-priority"
              name="priority"
              defaultValue={selectedPriority ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Apply filters
            </button>
          </div>

          <div className="flex items-end">
            <Link
              href={buildHref({
                basePath: "/tickets/all",
                doneMonth,
                companyId: selectedCompanyId,
                teamId: selectedTeamId,
                boardId: selectedBoardId,
              })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {assignedTickets.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            No assigned tickets for current filters.
          </p>
        ) : (
          assignedTickets.map((item) => {
            const isUrgent = item.ticket.priority === "URGENT";

            return (
              <article
                key={`${item.ticket.id}-${item.assigned_at}`}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  isUrgent ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{item.ticket.title}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      isUrgent ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.ticket.priority}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-600">
                  {item.ticket.description ?? "No description"}
                </p>

                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                  <span>Status: {item.ticket.status}</span>
                  <span>Workflow: {item.ticket.workflow_stage}</span>
                  <span>Team: {item.team?.name ?? "Unknown"}</span>
                  <span>Board: {item.board?.name ?? "Unknown"}</span>
                  <span>Estimated: {item.ticket.estimated_hours}h</span>
                  <span>Due: {item.ticket.due_date ?? "No due date"}</span>
                  <span>
                    Assigned at:{" "}
                    {new Date(item.assigned_at).toLocaleDateString("es-CO", { timeZone: "UTC" })}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
