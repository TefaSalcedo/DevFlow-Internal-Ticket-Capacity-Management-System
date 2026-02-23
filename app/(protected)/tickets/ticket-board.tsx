"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  deleteTicketAction,
  updateTicketDetailsAction,
  updateTicketStatusAction,
} from "@/app/(protected)/tickets/actions";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  TeamName,
  TicketPriority,
  TicketStatus,
  TicketWorkflowStage,
} from "@/lib/types/domain";

interface BoardTicket {
  id: string;
  company_id: string;
  project_id: string | null;
  team_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  estimated_hours: number;
  due_date: string | null;
  assigned_to: string | null;
  assignees?: Array<{
    user_id: string;
    full_name: string;
  }>;
  workflow_stage: TicketWorkflowStage;
  created_by: string;
  created_at: string;
}

interface BoardColumn {
  status: TicketStatus;
  items: BoardTicket[];
}

interface ProjectOption {
  id: string;
  company_id: string;
  code: string;
  name: string;
}

interface MemberOption {
  userId: string;
  fullName: string;
}

interface TeamOption {
  id: string;
  company_id: string;
  name: TeamName;
}

interface TicketBoardProps {
  initialBoard: BoardColumn[];
  projects: ProjectOption[];
  teams: TeamOption[];
  members: MemberOption[];
  selectedTeamId?: string;
  canManage: boolean;
}

interface EditingState {
  ticketId: string;
  title: string;
  description: string;
  projectId: string;
  teamId: string;
  workflowStage: TicketWorkflowStage;
  assignedToIds: string[];
  dueDate: string;
  priority: TicketPriority;
  estimatedHours: string;
}

function priorityTone(priority: TicketPriority) {
  if (priority === "URGENT") {
    return "danger" as const;
  }

  if (priority === "HIGH") {
    return "warning" as const;
  }

  if (priority === "LOW") {
    return "neutral" as const;
  }

  return "info" as const;
}

function workflowStageTone(workflowStage: TicketWorkflowStage) {
  if (workflowStage === "QA") {
    return "warning" as const;
  }

  if (workflowStage === "PR_REVIEW") {
    return "info" as const;
  }

  return "neutral" as const;
}

function formatWorkflowStage(workflowStage: TicketWorkflowStage) {
  if (workflowStage === "PR_REVIEW") {
    return "PR Review";
  }

  if (workflowStage === "QA") {
    return "QA";
  }

  return "DEV";
}

function moveTicketToStatus(columns: BoardColumn[], ticketId: string, nextStatus: TicketStatus) {
  const sourceColumn = columns.find((column) =>
    column.items.some((ticket) => ticket.id === ticketId)
  );

  if (!sourceColumn) {
    return columns;
  }

  const ticket = sourceColumn.items.find((item) => item.id === ticketId);
  if (!ticket) {
    return columns;
  }

  if (ticket.status === nextStatus) {
    return columns;
  }

  return columns.map((column) => {
    if (column.status === sourceColumn.status) {
      return {
        ...column,
        items: column.items.filter((item) => item.id !== ticketId),
      };
    }

    if (column.status === nextStatus) {
      return {
        ...column,
        items: [{ ...ticket, status: nextStatus }, ...column.items],
      };
    }

    return column;
  });
}

export function TicketBoard({
  initialBoard,
  projects,
  teams,
  members,
  selectedTeamId,
  canManage,
}: TicketBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [board, setBoard] = useState<BoardColumn[]>(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TicketStatus | null>(null);
  const [movingTicketId, setMovingTicketId] = useState<string | null>(null);

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const memberMap = useMemo(
    () =>
      new Map<string, string>(
        members.map((member) => {
          return [member.userId, member.fullName];
        })
      ),
    [members]
  );
  const editingTicketCompanyId = useMemo(() => {
    if (!editing) {
      return null;
    }

    return (
      board.flatMap((column) => column.items).find((ticket) => ticket.id === editing.ticketId)
        ?.company_id ?? null
    );
  }, [board, editing]);
  const editableProjects = useMemo(() => {
    if (!editingTicketCompanyId) {
      return projects;
    }

    return projects.filter((project) => project.company_id === editingTicketCompanyId);
  }, [projects, editingTicketCompanyId]);
  const teamNameById = useMemo(() => {
    return new Map<string, string>(teams.map((team) => [team.id, team.name]));
  }, [teams]);
  const editableTeams = useMemo(() => {
    if (!editingTicketCompanyId) {
      return teams;
    }

    const companyTeams = teams.filter((team) => team.company_id === editingTicketCompanyId);
    if (selectedTeamId) {
      return companyTeams.filter((team) => team.id === selectedTeamId);
    }

    return companyTeams;
  }, [teams, editingTicketCompanyId, selectedTeamId]);

  function startEditing(ticket: BoardTicket) {
    setError(null);
    setEditing({
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description ?? "",
      projectId: ticket.project_id ?? "",
      teamId: ticket.team_id ?? "",
      workflowStage: ticket.workflow_stage,
      assignedToIds: Array.from(
        new Set(
          (ticket.assignees ?? [])
            .map((assignee) => assignee.user_id)
            .concat(ticket.assigned_to ? [ticket.assigned_to] : [])
        )
      ),
      dueDate: ticket.due_date ?? "",
      priority: ticket.priority,
      estimatedHours: String(ticket.estimated_hours ?? 0),
    });
  }

  function handleDrop(columnStatus: TicketStatus, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDropTargetStatus(null);

    if (!canManage) {
      return;
    }

    const ticketId = event.dataTransfer.getData("text/plain");
    if (!ticketId) {
      return;
    }

    const sourceTicket = board
      .flatMap((column) => column.items)
      .find((ticket) => ticket.id === ticketId);
    if (!sourceTicket) {
      return;
    }

    if (sourceTicket.status === "DONE") {
      setError("Done tickets are read-only.");
      return;
    }

    if (sourceTicket.status === columnStatus) {
      return;
    }

    const snapshot = board;
    const optimistic = moveTicketToStatus(snapshot, ticketId, columnStatus);
    setBoard(optimistic);
    setMovingTicketId(ticketId);
    setError(null);

    startTransition(async () => {
      const result = await updateTicketStatusAction({ ticketId, status: columnStatus });
      if (result.error) {
        setBoard(snapshot);
        setMovingTicketId(null);
        setError(result.error);
        return;
      }

      setMovingTicketId(null);
    });
  }

  function handleSaveTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) {
      return;
    }

    const estimatedHours = Number(editing.estimatedHours);
    if (Number.isNaN(estimatedHours) || estimatedHours < 0) {
      setError("Estimated hours must be a valid positive number.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await updateTicketDetailsAction({
        ticketId: editing.ticketId,
        title: editing.title,
        description: editing.description || undefined,
        projectId: editing.projectId || undefined,
        teamId: editing.teamId || undefined,
        workflowStage: editing.workflowStage,
        assignedToIds: editing.assignedToIds,
        dueDate: editing.dueDate || undefined,
        priority: editing.priority,
        estimatedHours,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(ticket: BoardTicket) {
    if (!canManage || ticket.status === "DONE") {
      return;
    }

    const approved = window.confirm("Are you sure you want to delete this ticket?");
    if (!approved) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await deleteTicketAction({ ticketId: ticket.id });
      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {board.map((column) => (
          <article
            key={column.status}
            className={`rounded-xl border bg-white p-3 shadow-sm transition-colors ${
              draggingTicketId && dropTargetStatus === column.status
                ? "border-blue-300 bg-blue-50/40"
                : "border-slate-200"
            }`}
            onDragOver={(event) => {
              if (canManage) {
                event.preventDefault();
                setDropTargetStatus(column.status);
              }
            }}
            onDragLeave={() => {
              if (dropTargetStatus === column.status) {
                setDropTargetStatus(null);
              }
            }}
            onDrop={(event) => {
              handleDrop(column.status, event);
            }}
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
                column.items.map((ticket) => {
                  const isDone = ticket.status === "DONE";
                  const isEditing = editing?.ticketId === ticket.id;
                  const canDragTicket = canManage && !isDone && !isEditing && !isPending;

                  return (
                    <article
                      key={ticket.id}
                      draggable={canDragTicket}
                      onDragStart={(event) => {
                        if (!canDragTicket) {
                          return;
                        }

                        setDraggingTicketId(ticket.id);
                        event.dataTransfer.setData("text/plain", ticket.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingTicketId(null);
                        setDropTargetStatus(null);
                      }}
                      className={`rounded-lg border border-slate-200 bg-slate-50 p-3 transition ${
                        canDragTicket ? "cursor-grab" : ""
                      } ${
                        draggingTicketId === ticket.id
                          ? "opacity-60 ring-2 ring-blue-200"
                          : "opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{ticket.title}</p>
                        <div className="flex items-center gap-1">
                          <StatusBadge
                            label={formatWorkflowStage(ticket.workflow_stage)}
                            tone={workflowStageTone(ticket.workflow_stage)}
                          />
                          <StatusBadge
                            label={ticket.priority}
                            tone={priorityTone(ticket.priority)}
                          />
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-slate-600">
                        {ticket.description ?? "No description"}
                      </p>

                      <div className="mt-3 grid gap-1 text-xs text-slate-500">
                        <span>
                          Team:{" "}
                          {ticket.team_id
                            ? (teamNameById.get(ticket.team_id) ?? "Unknown")
                            : "Unassigned"}
                        </span>
                        <span>
                          Assignees: {(() => {
                            const assigneeNames = (ticket.assignees ?? [])
                              .map((assignee) => assignee.full_name)
                              .filter((name) => name.length > 0);

                            if (assigneeNames.length > 0) {
                              return assigneeNames.join(", ");
                            }

                            if (ticket.assigned_to) {
                              return memberMap.get(ticket.assigned_to) ?? "Unknown";
                            }

                            return "Unassigned";
                          })()}
                        </span>
                        <span>{ticket.estimated_hours}h est.</span>
                        <span>{ticket.due_date ?? "No due date"}</span>
                      </div>

                      {movingTicketId === ticket.id && (
                        <p className="mt-2 text-[11px] font-medium text-blue-700">Moving...</p>
                      )}

                      {isDone && (
                        <p className="mt-3 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                          Done tickets are read-only.
                        </p>
                      )}

                      {canManage && !isDone && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(ticket)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                            disabled={isPending}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ticket)}
                            className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </article>
        ))}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit ticket</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="space-y-3">
              <div>
                <label
                  htmlFor="ticket-modal-title"
                  className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                >
                  Title
                </label>
                <input
                  id="ticket-modal-title"
                  value={editing.title}
                  onChange={(event) => {
                    setEditing((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        title: event.target.value,
                      };
                    });
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="ticket-modal-description"
                  className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                >
                  Description
                </label>
                <textarea
                  id="ticket-modal-description"
                  value={editing.description}
                  onChange={(event) => {
                    setEditing((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        description: event.target.value,
                      };
                    });
                  }}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="ticket-modal-project"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Project
                  </label>
                  <select
                    id="ticket-modal-project"
                    value={editing.projectId}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          projectId: event.target.value,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {editableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} · {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-modal-team"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Team
                  </label>
                  <select
                    id="ticket-modal-team"
                    value={editing.teamId}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          teamId: event.target.value,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {editableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-modal-assignee"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Assignees
                  </label>
                  <select
                    id="ticket-modal-assignee"
                    multiple
                    value={editing.assignedToIds}
                    onChange={(event) => {
                      const selectedIds = Array.from(
                        event.target.selectedOptions,
                        (option) => option.value
                      );

                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          assignedToIds: selectedIds,
                        };
                      });
                    }}
                    className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use Ctrl/Cmd + click to select multiple people.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor="ticket-modal-workflow-stage"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Work stage
                  </label>
                  <select
                    id="ticket-modal-workflow-stage"
                    value={editing.workflowStage}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          workflowStage: event.target.value as TicketWorkflowStage,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="DEVELOPMENT">DEV</option>
                    <option value="QA">QA</option>
                    <option value="PR_REVIEW">PR Review</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-modal-priority"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Priority
                  </label>
                  <select
                    id="ticket-modal-priority"
                    value={editing.priority}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          priority: event.target.value as TicketPriority,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-modal-hours"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Hours
                  </label>
                  <input
                    id="ticket-modal-hours"
                    type="number"
                    step="0.5"
                    min={0}
                    value={editing.estimatedHours}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          estimatedHours: event.target.value,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ticket-modal-due-date"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Due date
                  </label>
                  <input
                    id="ticket-modal-due-date"
                    type="date"
                    value={editing.dueDate}
                    onChange={(event) => {
                      setEditing((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          dueDate: event.target.value,
                        };
                      });
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
