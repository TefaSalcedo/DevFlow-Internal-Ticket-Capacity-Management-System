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

interface SalesPageProps {
  searchParams: Promise<{
    doneMonth?: string;
    team?: string;
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

function buildSalesHref(input: { doneMonth: string; teamId?: string | null }) {
  const params = new URLSearchParams();
  params.set("doneMonth", input.doneMonth);

  if (input.teamId) {
    params.set("team", input.teamId);
  }

  return `/sales?${params.toString()}`;
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

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = await searchParams;
  const doneMonth = normalizeDoneMonth(params.doneMonth);
  const prevDoneMonth = shiftMonth(doneMonth, -1);
  const nextDoneMonth = shiftMonth(doneMonth, 1);

  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = auth.activeCompanyId ?? companies[0]?.id ?? null;
  const teams = await getTeams(auth, selectedCompanyId);
  const selectedTeamId = resolveOptionalId(params.team, teams);

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

  // Verificar si el usuario tiene permisos de solo lectura (READER) o super admin
  const canViewSales =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId &&
        ["READER", "COMPANY_ADMIN", "MANAGE_TEAM", "TICKET_CREATOR"].includes(membership.role)
    );

  // Si no tiene permisos, redirigir a dashboard
  if (!canViewSales) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Acceso Restringido</h3>
          <p className="text-sm text-red-700">
            No tienes permisos para acceder a la vista de Ventas. Por favor contacta al administrador.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const prevMonthHref = buildSalesHref({
    doneMonth: prevDoneMonth,
    teamId: selectedTeamId,
  });

  const nextMonthHref = buildSalesHref({
    doneMonth: nextDoneMonth,
    teamId: selectedTeamId,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ventas - Vista de Solo Lectura
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Panel de Ventas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vista de solo lectura de los tickets. Filtrado por mes de finalización:{" "}
            <span className="font-semibold">{formatMonthLabel(doneMonth)}</span>
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Modo solo lectura
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={prevMonthHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Mes anterior
          </Link>
          <Link
            href={nextMonthHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Mes siguiente →
          </Link>
          <Link
            href="/tickets"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Vista completa
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]" method="GET">
          <input type="hidden" name="doneMonth" value={doneMonth} />
          <div>
            <label
              htmlFor="sales-team-scope"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Equipo
            </label>
            <select
              id="sales-team-scope"
              name="team"
              defaultValue={selectedTeamId ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Seleccione un equipo</option>
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
              Aplicar
            </button>
          </div>
        </form>
      </section>

      {selectedTeamId ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="size-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-amber-800">
                Esta es una vista de solo lectura. No puedes modificar ni crear tickets desde aquí.
              </p>
            </div>
          </div>

          <TicketBoard
            initialBoard={board}
            projects={projects}
            members={members.map((member) => ({
              userId: member.userId,
              fullName: member.fullName,
            }))}
            canManage={false} // Siempre false para ventas - solo lectura
            groupByProject
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 mb-4">
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
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Seleccione un equipo</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Para ver los tickets en el panel de ventas, por favor seleccione un equipo en el filtro superior.
          </p>
        </div>
      )}
    </div>
  );
}
