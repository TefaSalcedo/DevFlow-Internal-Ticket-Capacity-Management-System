import Link from "next/link";

import { TicketBoard } from "@/app/(protected)/tickets/ticket-board";
import { getAuthContext } from "@/lib/auth/session";
import { getProjects, getTeamWorkload, getTicketBoard } from "@/lib/data/queries";

interface TicketsPageProps {
  searchParams: Promise<{
    doneMonth?: string;
  }>;
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
  const [board, projects, members] = await Promise.all([
    getTicketBoard(auth, undefined, doneMonth),
    getProjects(auth),
    getTeamWorkload(auth),
  ]);

  const canManageTickets =
    auth.isSuperAdmin ||
    auth.memberships.some((membership) =>
      ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ticket Board</h2>
          <p className="mt-1 text-sm text-slate-600">
            DONE filtrado por creación:{" "}
            <span className="font-semibold">{formatMonthLabel(doneMonth)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/tickets?doneMonth=${prevDoneMonth}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Mes anterior DONE
          </Link>
          <Link
            href={`/tickets?doneMonth=${nextDoneMonth}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Mes siguiente DONE →
          </Link>
          <Link
            href="/tickets/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            + New Ticket
          </Link>
        </div>
      </header>

      <TicketBoard
        initialBoard={board}
        projects={projects}
        members={members.map((member) => ({
          userId: member.userId,
          fullName: member.fullName,
        }))}
        canManage={canManageTickets}
      />
    </div>
  );
}
