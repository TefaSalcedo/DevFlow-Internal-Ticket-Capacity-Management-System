import Link from "next/link";

import { TicketBoard } from "@/app/(protected)/tickets/ticket-board";
import { getAuthContext } from "@/lib/auth/session";
import {
  getCompaniesForUser,
  getProjects,
  getTeams,
  getTeamWorkload,
  getTicketBoard,
} from "@/lib/data/queries";

interface TicketsPageProps {
  searchParams: Promise<{
    doneMonth?: string;
    team?: string;
  }>;
}

const BOARD_STATUSES = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"] as const;

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

function buildTicketsHref(input: { doneMonth: string; teamId?: string | null }) {
  const params = new URLSearchParams();
  params.set("doneMonth", input.doneMonth);

  if (input.teamId) {
    params.set("team", input.teamId);
  }

  return `/tickets?${params.toString()}`;
}

function normalizeDoneMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const currentMonth = Number(monthPart);
  const date = new Date(Date.UTC(year, currentMonth - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [yearPart, monthPart] = month.split("-");
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 1));
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;
  const doneMonth = normalizeDoneMonth(params.doneMonth);
  const prevDoneMonth = shiftMonth(doneMonth, -1);
  const nextDoneMonth = shiftMonth(doneMonth, 1);

  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = auth.activeCompanyId ?? companies[0]?.id ?? null;
  const teams = await getTeams(auth, selectedCompanyId);
  const selectedTeamId = resolveSelectedId(params.team, teams);

  const [board, projects, members] = await Promise.all([
    selectedTeamId
      ? getTicketBoard(auth, {
          companyId: selectedCompanyId,
          teamId: selectedTeamId,
          doneMonth,
        })
      : Promise.resolve(
          BOARD_STATUSES.map((status) => ({
            status,
            items: [],
          }))
        ),
    getProjects(auth, selectedCompanyId),
    getTeamWorkload(auth, selectedCompanyId),
  ]);

  const canManageTickets =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId &&
        ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
    );

  const prevMonthHref = buildTicketsHref({
    doneMonth: prevDoneMonth,
    teamId: selectedTeamId,
  });

  const nextMonthHref = buildTicketsHref({
    doneMonth: nextDoneMonth,
    teamId: selectedTeamId,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ticket Board</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vista Kanban por equipo, agrupada por proyecto. DONE filtrado por creación:{" "}
            <span className="font-semibold">{formatMonthLabel(doneMonth)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={prevMonthHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Mes anterior DONE
          </Link>
          <Link
            href={nextMonthHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Mes siguiente DONE →
          </Link>
          <Link
            href={buildTicketsHref({
              doneMonth,
              teamId: selectedTeamId,
            }).replace("/tickets?", "/tickets/all?")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            All Tasks
          </Link>
          <Link
            href={buildTicketsHref({
              doneMonth,
              teamId: selectedTeamId,
            }).replace("/tickets?", "/tickets/mine?")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            My Tasks
          </Link>
          <Link
            href="/tickets/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            + New Ticket
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]" method="GET">
          <input type="hidden" name="doneMonth" value={doneMonth} />
          <div>
            <label
              htmlFor="ticket-team-scope"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Team
            </label>
            <select
              id="ticket-team-scope"
              name="team"
              defaultValue={selectedTeamId ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Apply
            </button>
          </div>
        </form>
      </section>

      <TicketBoard
        initialBoard={board}
        projects={projects}
        members={members.map((member) => ({
          userId: member.userId,
          fullName: member.fullName,
        }))}
        canManage={canManageTickets}
        groupByProject
      />
    </div>
  );
}
