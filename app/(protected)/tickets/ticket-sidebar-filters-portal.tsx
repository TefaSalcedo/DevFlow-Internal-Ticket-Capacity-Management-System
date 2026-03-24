"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { applyTicketScopeAction } from "@/app/(protected)/tickets/scope-actions";

interface TeamOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

interface TicketSidebarFiltersPortalProps {
  companyId: string | null;
  doneMonth: string;
  teams: TeamOption[];
  selectedTeamId: string | null;
  projects: ProjectOption[];
  selectedProjectIds: string[];
}

export function TicketSidebarFiltersPortal({
  companyId,
  doneMonth,
  teams,
  selectedTeamId,
  projects,
  selectedProjectIds,
}: TicketSidebarFiltersPortalProps) {
  const [slotElement, setSlotElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const slot = document.getElementById("ticket-sidebar-filters-slot");
    setSlotElement(slot);
  }, []);

  if (!slotElement) {
    return null;
  }

  return createPortal(
    <form className="space-y-4" action={applyTicketScopeAction}>
      <input type="hidden" name="companyId" value={companyId ?? ""} />
      <input type="hidden" name="doneMonth" value={doneMonth} />

      <div>
        <label
          htmlFor="ticket-team-scope"
          className="mb-1 block text-xs font-semibold uppercase text-slate-300"
        >
          Team
        </label>
        <select
          id="ticket-team-scope"
          name="team"
          defaultValue={selectedTeamId ?? ""}
          className="w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Seleccione su equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 block text-xs font-semibold uppercase text-slate-300">Projects</p>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/70 px-2 py-2">
          {projects.length === 0 ? (
            <p className="px-1 text-xs text-slate-400">No hay proyectos disponibles.</p>
          ) : (
            projects.map((project) => {
              const checked = selectedProjectIds.includes(project.id);
              return (
                <label
                  key={project.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-slate-100 hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    name="projects"
                    value={project.id}
                    defaultChecked={checked}
                    className="mt-0.5 size-4 rounded border-slate-500 bg-slate-900 text-indigo-500"
                  />
                  <span>
                    {project.code} · {project.name}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">Marca los proyectos que quieras ver.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="submit"
          className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          Apply filters
        </button>
        <button
          type="submit"
          name="clearProjects"
          value="1"
          className="w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          Mostrar todos
        </button>
      </div>
    </form>,
    slotElement
  );
}
