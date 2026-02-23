import Link from "next/link";

import { TicketBoard } from "@/app/(protected)/tickets/ticket-board";
import { getAuthContext } from "@/lib/auth/session";
import {
  getAssignedTicketsForCurrentUser,
  getCompaniesForUser,
  getProjects,
  getTeamWorkload,
} from "@/lib/data/queries";

const STATUS_OPTIONS = ["BACKLOG", "ACTIVE", "BLOCKED", "DONE"] as const;

function buildHref(input: { basePath: string; doneMonth: string }) {
  const params = new URLSearchParams();
  params.set("doneMonth", input.doneMonth);
  return `${input.basePath}?${params.toString()}`;
}

export default async function TicketsMinePage({
  searchParams,
}: {
  searchParams: Promise<{
    doneMonth?: string;
  }>;
}) {
  const params = await searchParams;
  const doneMonth =
    params.doneMonth && /^\d{4}-\d{2}$/.test(params.doneMonth)
      ? params.doneMonth
      : `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const selectedCompanyId = auth.activeCompanyId ?? companies[0]?.id ?? null;

  const canManageTickets =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === selectedCompanyId &&
        ["COMPANY_ADMIN", "TICKET_CREATOR"].includes(membership.role)
    );

  const [assignedTickets, projects, members] = await Promise.all([
    getAssignedTicketsForCurrentUser(auth, {
      companyId: selectedCompanyId,
    }),
    getProjects(auth, selectedCompanyId),
    getTeamWorkload(auth, selectedCompanyId),
  ]);

  const board = STATUS_OPTIONS.map((status) => ({
    status,
    items: assignedTickets
      .filter((item) => item.ticket.status === status)
      .map((item) => ({
        ...item.ticket,
        assignees: item.ticket.assignees,
      })),
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tickets
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">My Tasks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kanban personal sin filtros, agrupado por proyecto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({
              basePath: "/tickets/all",
              doneMonth,
            })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            All Tasks
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
        groupByProject
      />
    </div>
  );
}
