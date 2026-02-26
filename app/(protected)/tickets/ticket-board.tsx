"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  deleteTicketAction,
  updateTicketDetailsAction,
  updateTicketStatusAction,
} from "@/app/(protected)/tickets/actions";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TicketPriority, TicketStatus, TicketWorkflowStage } from "@/lib/types/domain";

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

interface TicketBoardProps {
  initialBoard: BoardColumn[];
  projects: ProjectOption[];
  members: MemberOption[];
  canManage: boolean;
  groupByProject?: boolean;
}

interface EditingState {
  ticketId: string;
  title: string;
  description: string;
  projectId: string;
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
  if (workflowStage === "BUG") {
    return "danger" as const;
  }

  if (workflowStage === "NEW") {
    return "info" as const;
  }

  if (workflowStage === "ANALYSIS") {
    return "warning" as const;
  }

  if (workflowStage === "RESEARCH") {
    return "info" as const;
  }

  if (workflowStage === "SUPPORT") {
    return "neutral" as const;
  }

  if (workflowStage === "QA") {
    return "warning" as const;
  }

  if (workflowStage === "PR_REVIEW") {
    return "info" as const;
  }

  if (workflowStage === "ADMIN") {
    return "neutral" as const;
  }

  if (workflowStage === "MEETING") {
    return "info" as const;
  }

  return "neutral" as const;
}

function formatWorkflowStage(workflowStage: TicketWorkflowStage) {
  if (workflowStage === "NEW") {
    return "New";
  }

  if (workflowStage === "ANALYSIS") {
    return "Analysis";
  }

  if (workflowStage === "RESEARCH") {
    return "Research";
  }

  if (workflowStage === "SUPPORT") {
    return "Support";
  }

  if (workflowStage === "DESIGN") {
    return "Design";
  }

  if (workflowStage === "BUG") {
    return "Bug";
  }

  if (workflowStage === "PR_REVIEW") {
    return "PR Review";
  }

  if (workflowStage === "QA") {
    return "QA";
  }

  if (workflowStage === "ADMIN") {
    return "Admin";
  }

  if (workflowStage === "MEETING") {
    return "Meeting";
  }

  return "DEV";
}

function projectBadgeStyle(projectId: string) {
  let hash = 0;
  for (const char of projectId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const hue = hash % 360;

  return {
    backgroundColor: `hsl(${hue} 92% 95%)`,
    borderColor: `hsl(${hue} 70% 72%)`,
    color: `hsl(${hue} 65% 30%)`,
  };
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

function columnTheme(status: TicketStatus) {
  switch (status) {
    case "BACKLOG":
      return {
        bg: "bg-gradient-to-br from-slate-50 to-slate-100",
        border: "border-slate-300",
        header: "text-slate-800",
        headerBg: "bg-slate-100/80",
      };
    case "ACTIVE":
      return {
        bg: "bg-gradient-to-br from-blue-50 to-indigo-100",
        border: "border-blue-300",
        header: "text-blue-800",
        headerBg: "bg-blue-100/80",
      };
    case "BLOCKED":
      return {
        bg: "bg-gradient-to-br from-amber-50 to-orange-100",
        border: "border-amber-300",
        header: "text-amber-800",
        headerBg: "bg-amber-100/80",
      };
    case "DONE":
      return {
        bg: "bg-gradient-to-br from-emerald-50 to-green-100",
        border: "border-emerald-300",
        header: "text-emerald-800",
        headerBg: "bg-emerald-100/80",
      };
    default:
      return {
        bg: "bg-white",
        border: "border-slate-200",
        header: "text-slate-700",
        headerBg: "bg-slate-50",
      };
  }
}

export function TicketBoard({
  initialBoard,
  projects,
  members,
  canManage,
  groupByProject = false,
}: TicketBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [board, setBoard] = useState<BoardColumn[]>(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TicketStatus | null>(null);
  const [movingTicketId, setMovingTicketId] = useState<string | null>(null);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

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
  const projectMap = useMemo(
    () =>
      new Map<string, ProjectOption>(
        projects.map((project) => {
          return [project.id, project];
        })
      ),
    [projects]
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

  function startEditing(ticket: BoardTicket) {
    setError(null);
    setEditing({
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description ?? "",
      projectId: ticket.project_id ?? "",
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

  function toggleExpanded(ticketId: string) {
    setExpandedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
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
        {board.map((column) => {
          const displayItems = groupByProject
            ? [...column.items].sort((left, right) => {
                const leftProject = left.project_id
                  ? (projectMap.get(left.project_id) ?? null)
                  : null;
                const rightProject = right.project_id
                  ? (projectMap.get(right.project_id) ?? null)
                  : null;

                const leftLabel = leftProject
                  ? `${leftProject.code} · ${leftProject.name}`
                  : "Unassigned project";
                const rightLabel = rightProject
                  ? `${rightProject.code} · ${rightProject.name}`
                  : "Unassigned project";

                return leftLabel.localeCompare(rightLabel);
              })
            : column.items;

          return (
            <article
              key={column.status}
              className={`rounded-xl border p-3 shadow-sm transition-all duration-300 ${
                draggingTicketId && dropTargetStatus === column.status
                  ? "ring-2 ring-blue-400 ring-offset-2 scale-[1.02]"
                  : ""
              } ${columnTheme(column.status).bg} ${columnTheme(column.status).border}`}
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
              <div
                className={`mb-3 flex items-center justify-between rounded-lg ${columnTheme(column.status).headerBg} px-3 py-2`}
              >
                <h3
                  className={`text-sm font-bold uppercase tracking-wider ${columnTheme(column.status).header}`}
                >
                  {column.status}
                </h3>
                <StatusBadge label={`${displayItems.length}`} tone="neutral" />
              </div>

              <div className="space-y-3">
                {displayItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-3 text-sm text-slate-500">
                    No tickets in this column.
                  </p>
                ) : (
                  displayItems.map((ticket, index) => {
                    const currentProjectKey = ticket.project_id ?? "__unassigned_project__";
                    const previousProjectKey =
                      index > 0
                        ? (displayItems[index - 1]?.project_id ?? "__unassigned_project__")
                        : null;
                    const shouldRenderProjectHeader =
                      groupByProject && (index === 0 || currentProjectKey !== previousProjectKey);
                    const projectForHeader = ticket.project_id
                      ? (projectMap.get(ticket.project_id) ?? null)
                      : null;
                    const projectHeaderLabel = projectForHeader
                      ? `${projectForHeader.code} · ${projectForHeader.name}`
                      : "Unassigned project";

                    return (
                      <div key={ticket.id} className="space-y-2">
                        {shouldRenderProjectHeader && (
                          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white/90 px-2 py-1 shadow-sm">
                            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {projectHeaderLabel}
                            </p>
                          </div>
                        )}

                        {(() => {
                          const isDone = ticket.status === "DONE";
                          const isEditing = editing?.ticketId === ticket.id;
                          const canDragTicket = canManage && !isDone && !isEditing && !isPending;
                          const project = ticket.project_id
                            ? (projectMap.get(ticket.project_id) ?? null)
                            : null;
                          const isExpanded = expandedTickets.has(ticket.id);

                          return (
                            <button
                              type="button"
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
                              className={`rounded-lg border bg-white/95 backdrop-blur-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] text-left w-full ${
                                canDragTicket ? "cursor-grab active:cursor-grabbing" : ""
                              } ${
                                draggingTicketId === ticket.id
                                  ? "opacity-60 ring-2 ring-blue-300 shadow-lg scale-95"
                                  : "opacity-100 hover:border-slate-300"
                              } ${!isExpanded ? "py-3 px-4" : "p-4"}`}
                              onClick={() => toggleExpanded(ticket.id)}
                              aria-expanded={isExpanded}
                              aria-label={`Ticket: ${ticket.title}, ${isExpanded ? "collapsed" : "expanded"}`}
                            >
                              {/* Compact view - always visible */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-base font-semibold text-slate-900 leading-tight mb-1">
                                    {ticket.title}
                                  </p>
                                  <div className="flex items-center gap-1.5">
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
                                <div className="flex items-center text-slate-400">
                                  <svg
                                    className={`w-4 h-4 transition-transform duration-200 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded view - visible only when expanded */}
                              {isExpanded && (
                                <div className="mt-2 space-y-2">
                                  <p className="text-xs text-slate-600">
                                    {ticket.description ?? "No description"}
                                  </p>

                                  <div>
                                    {project ? (
                                      <span
                                        className="inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold"
                                        style={projectBadgeStyle(project.id)}
                                      >
                                        {project.code} · {project.name}
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                        Unassigned project
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid gap-1 text-xs text-slate-500">
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
                                    <p className="text-[11px] font-medium text-blue-700">
                                      Moving...
                                    </p>
                                  )}

                                  {isDone && (
                                    <p className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                      Done tickets are read-only.
                                    </p>
                                  )}

                                  {canManage && !isDone && (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditing(ticket);
                                        }}
                                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                                        disabled={isPending}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(ticket);
                                        }}
                                        className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                                        disabled={isPending}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          );
        })}
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

              <div className="grid gap-3 sm:grid-cols-2">
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
                  {(() => {
                    if (!editing.projectId) {
                      return (
                        <p className="mt-1 text-[11px] text-slate-500">
                          No project assigned to this ticket.
                        </p>
                      );
                    }

                    const selectedProject = projectMap.get(editing.projectId);
                    if (!selectedProject) {
                      return null;
                    }

                    return (
                      <div className="mt-1">
                        <span
                          className="inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold"
                          style={projectBadgeStyle(selectedProject.id)}
                        >
                          {selectedProject.code} · {selectedProject.name}
                        </span>
                      </div>
                    );
                  })()}
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
                    <option value="NEW">New</option>
                    <option value="ANALYSIS">Analysis</option>
                    <option value="RESEARCH">Research</option>
                    <option value="SUPPORT">Support</option>
                    <option value="DEVELOPMENT">DEV</option>
                    <option value="DESIGN">Design</option>
                    <option value="QA">QA</option>
                    <option value="PR_REVIEW">PR Review</option>
                    <option value="BUG">Bug</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MEETING">Meeting</option>
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
