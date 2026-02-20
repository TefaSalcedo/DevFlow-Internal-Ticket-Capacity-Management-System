import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getTicketBoard } from "@/lib/data/queries";

function priorityTone(priority: string) {
  if (priority === "URGENT") {
    return "danger";
  }

  if (priority === "HIGH") {
    return "warning";
  }

  if (priority === "LOW") {
    return "neutral";
  }

  return "info";
}

export default async function TicketsPage() {
  const auth = await getAuthContext();
  const board = await getTicketBoard(auth);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ticket Board</h2>
        </div>

        <Link
          href="/tickets/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          + New Ticket
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.map((column) => (
          <article
            key={column.status}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                {column.status}
              </h3>
              <StatusBadge label={`${column.items.length}`} tone="neutral" />
            </div>

            <div className="space-y-3">
              {column.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  No tickets in this column.
                </p>
              ) : (
                column.items.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{ticket.title}</p>
                      <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {ticket.description ?? "No description"}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{ticket.estimated_hours}h est.</span>
                      <span>{ticket.due_date ?? "No due date"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
