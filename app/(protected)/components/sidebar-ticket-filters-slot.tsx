"use client";

import { usePathname } from "next/navigation";

export function SidebarTicketFiltersSlot() {
  const pathname = usePathname();

  if (pathname !== "/tickets") {
    return null;
  }

  return (
    <div className="px-4 pb-5">
      <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          Ticket filters
        </p>
        <div id="ticket-sidebar-filters-slot" />
      </div>
    </div>
  );
}
