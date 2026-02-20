"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  deleteTicketAction,
  updateTicketDetailsAction,
  updateTicketStatusAction,
} from "@/app/(protected)/tickets/actions";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TicketPriority, TicketStatus } from "@/lib/types/domain";

interface BoardTicket {
  id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  estimated_hours: number;
  due_date: string | null;
  assigned_to: string | null;
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

interface TicketBoardProps {
  initialBoard: BoardColumn[];
  projects: ProjectOption[];
  members: MemberOption[];
  canManage: boolean;
}

interface EditingState {
  ticketId: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo: string;
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

export function TicketBoard({ initialBoard, projects, members, canManage }: TicketBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [board, setBoard] = useState<BoardColumn[]>(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

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

  function startEditing(ticket: BoardTicket) {
    setError(null);
    setEditing({
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description ?? "",
      projectId: ticket.project_id ?? "",
      assignedTo: ticket.assigned_to ?? "",
      dueDate: ticket.due_date ?? "",
      priority: ticket.priority,
      estimatedHours: String(ticket.estimated_hours ?? 0),
    });
  }

  function handleDrop(columnStatus: TicketStatus, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();

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
    setError(null);

    startTransition(async () => {
      const result = await updateTicketStatusAction({ ticketId, status: columnStatus });
      if (result.error) {
        setBoard(snapshot);
        setError(result.error);
        return;
      }

      router.refresh();
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
        assignedTo: editing.assignedTo || undefined,
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.map((column) => (
          <article
            key={column.status}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            onDragOver={(event) => {
              if (canManage) {
                event.preventDefault();
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
                  const fieldPrefix = `ticket-${ticket.id}`;
                  const availableProjects = projects.filter(
                    (project) => project.company_id === ticket.company_id
                  );

                  return (
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

                      <div className="mt-3 grid gap-1 text-xs text-slate-500">
                        <span>
                          Assignee:{" "}
                          {ticket.assigned_to
                            ? (memberMap.get(ticket.assigned_to) ?? "Unknown")
                            : "Unassigned"}
                        </span>
                        <span>{ticket.estimated_hours}h est.</span>
                        <span>{ticket.due_date ?? "No due date"}</span>
                      </div>

                      {isDone && (
                        <p className="mt-3 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                          Done tickets are read-only.
                        </p>
                      )}

                      {canManage && !isDone && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", ticket.id);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                            disabled={isPending}
                          >
                            Drag
                          </button>
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

                      {isEditing && canManage && !isDone && (
                        <form
                          onSubmit={handleSaveTicket}
                          className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3"
                        >
                          <div>
                            <label
                              htmlFor={`${fieldPrefix}-title`}
                              className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                            >
                              Title
                            </label>
                            <input
                              id={`${fieldPrefix}-title`}
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
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              required
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`${fieldPrefix}-description`}
                              className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                            >
                              Description
                            </label>
                            <textarea
                              id={`${fieldPrefix}-description`}
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
                              rows={3}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label
                                htmlFor={`${fieldPrefix}-project`}
                                className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                              >
                                Project
                              </label>
                              <select
                                id={`${fieldPrefix}-project`}
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
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              >
                                <option value="">Unassigned</option>
                                {availableProjects.map((project) => (
                                  <option key={project.id} value={project.id}>
                                    {project.code} · {project.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`${fieldPrefix}-assignee`}
                                className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                              >
                                Assignee
                              </label>
                              <select
                                id={`${fieldPrefix}-assignee`}
                                value={editing.assignedTo}
                                onChange={(event) => {
                                  setEditing((current) => {
                                    if (!current) {
                                      return current;
                                    }

                                    return {
                                      ...current,
                                      assignedTo: event.target.value,
                                    };
                                  });
                                }}
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              >
                                <option value="">Unassigned</option>
                                {members.map((member) => (
                                  <option key={member.userId} value={member.userId}>
                                    {member.fullName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label
                                htmlFor={`${fieldPrefix}-priority`}
                                className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                              >
                                Priority
                              </label>
                              <select
                                id={`${fieldPrefix}-priority`}
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
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`${fieldPrefix}-hours`}
                                className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                              >
                                Hours
                              </label>
                              <input
                                id={`${fieldPrefix}-hours`}
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
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`${fieldPrefix}-due-date`}
                                className="mb-1 block text-[11px] font-semibold uppercase text-slate-500"
                              >
                                Due date
                              </label>
                              <input
                                id={`${fieldPrefix}-due-date`}
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
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isPending}
                              className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
