import Link from "next/link";

import { AssignmentNotifier } from "@/app/(protected)/tickets/assignment-notifier";
import { TicketBoard } from "@/app/(protected)/tickets/ticket-board";
import { TicketSidebarFiltersPortal } from "@/app/(protected)/tickets/ticket-sidebar-filters-portal";
import { getAuthContext } from "@/lib/auth/session";
import {
  getActiveTeamIdsForUserInCompany,
  getCompaniesForUser,
  getPreferredTeamIdForUser,
  getProjects,
  getTeams,
  getTeamWorkload,
  getTicketBoard,
} from "@/lib/data/queries";

interface TicketsPageProps {
  searchParams: Promise<{
    doneMonth?: string;
    team?: string;
    projects?: string;
  }>;
}

const BOARD_STATUSES = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"] as const;

function resolveOptionalId<T extends { id: string }>(
  preferredId: string | undefined,
  collection: T[]
) {
  if (!preferredId) {
    return null;
  }

  return collection.some((item) => item.id === preferredId) ? preferredId : null;
}

function buildTicketsHref(input: {
  doneMonth: string;
  teamId?: string | null;
  projectIds?: string[];
}) {
  const params = new URLSearchParams();
  params.set("doneMonth", input.doneMonth);

  if (input.teamId) {
    params.set("team", input.teamId);
  }

  if ((input.projectIds ?? []).length > 0) {
    params.set("projects", Array.from(new Set(input.projectIds ?? [])).join(","));
  }

  return `/tickets?${params.toString()}`;
}

function parseProjectIds(value: string | undefined, allowedProjects: Array<{ id: string }>) {
  if (!value) {
    return [] as string[];
  }

  const allowedSet = new Set(allowedProjects.map((project) => project.id));
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && allowedSet.has(entry))
    )
  );
}

function compareProjectsForScope(
  left: { code: string; name: string },
  right: { code: string; name: string }
) {
  const leftIsGpc = left.code.toUpperCase().startsWith("GPC");
  const rightIsGpc = right.code.toUpperCase().startsWith("GPC");

  if (leftIsGpc !== rightIsGpc) {
    return leftIsGpc ? -1 : 1;
  }

  const byCode = left.code.localeCompare(right.code, "es", { sensitivity: "base" });
  if (byCode !== 0) {
    return byCode;
  }

  return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
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
  const [teams, preferredTeamId, activeTeamIds] = await Promise.all([
    getTeams(auth, selectedCompanyId),
    getPreferredTeamIdForUser(auth, selectedCompanyId),
    getActiveTeamIdsForUserInCompany(auth, selectedCompanyId),
  ]);

  const activeTeamIdByOrder = teams.find((team) => activeTeamIds.includes(team.id))?.id ?? null;
  const selectedTeamId =
    resolveOptionalId(params.team, teams) ??
    resolveOptionalId(preferredTeamId ?? undefined, teams) ??
    resolveOptionalId(activeTeamIdByOrder ?? undefined, teams);

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
  const selectedProjectIds = parseProjectIds(params.projects, projects);
  const sortedProjects = [...projects].sort(compareProjectsForScope);

  const canManageTickets =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId &&
        ["COMPANY_ADMIN", "MANAGE_TEAM", "TICKET_CREATOR"].includes(membership.role)
    );

  const prevMonthHref = buildTicketsHref({
    doneMonth: prevDoneMonth,
    teamId: selectedTeamId,
    projectIds: selectedProjectIds,
  });

  const nextMonthHref = buildTicketsHref({
    doneMonth: nextDoneMonth,
    teamId: selectedTeamId,
    projectIds: selectedProjectIds,
  });

  const newTicketHref = (() => {
    const nextParams = new URLSearchParams();
    if (selectedCompanyId) {
      nextParams.set("companyId", selectedCompanyId);
    }
    if (selectedTeamId) {
      nextParams.set("teamId", selectedTeamId);
    }
    return `/tickets/new${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
  })();

  return (
    <div className="space-y-5">
      <AssignmentNotifier userId={auth.user.id} companyId={selectedCompanyId} />
      <TicketSidebarFiltersPortal
        companyId={selectedCompanyId}
        doneMonth={doneMonth}
        teams={teams}
        selectedTeamId={selectedTeamId}
        projects={sortedProjects}
        selectedProjectIds={selectedProjectIds}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ticket Board</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vista Kanban por equipo, agrupada por proyecto. DONE filtrado por finalización:{" "}
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
              projectIds: selectedProjectIds,
            }).replace("/tickets?", "/tickets/all?")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            All Tasks
          </Link>
          <Link
            href={buildTicketsHref({
              doneMonth,
              teamId: selectedTeamId,
              projectIds: selectedProjectIds,
            }).replace("/tickets?", "/tickets/mine?")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            My Tasks
          </Link>
          {canManageTickets && (
            <Link
              href={newTicketHref}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              + New Ticket
            </Link>
          )}
        </div>
      </header>

      <section className="min-w-0">
        {selectedTeamId ? (
          <TicketBoard
            initialBoard={board}
            projects={projects}
            members={members.map((member) => ({
              userId: member.userId,
              fullName: member.fullName,
            }))}
            canManage={canManageTickets}
            groupByProject
            selectedProjectIds={selectedProjectIds}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
              <svg
                className="size-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Seleccione su equipo</h3>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              Para ver las tareas pendientes en el tablero, por favor seleccione un equipo en el
              menú lateral.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
