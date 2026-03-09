"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  type CreateTicketState,
  createTicketAction,
} from "@/app/(protected)/tickets/new/actions";
import { SubmitButton } from "@/components/ui/submit-button";

interface TicketFormProps {
  companies: Array<{
    id: string;
    name: string;
  }>;
  projects: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  members: Array<{
    userId: string;
    fullName: string;
  }>;
  teams: Array<{
    id: string;
    companyId: string;
    name: string;
  }>;
  boards: Array<{
    id: string;
    companyId: string;
    teamId: string;
    name: string;
  }>;
  defaultCompanyId?: string;
  defaultTeamId?: string;
  defaultBoardId?: string;
  defaultParentTicketId?: string;
}

const initialState: CreateTicketState = {};

export function TicketForm({
  companies,
  projects,
  members,
  teams,
  boards,
  defaultCompanyId,
  defaultTeamId,
  defaultBoardId,
  defaultParentTicketId,
}: TicketFormProps) {
  const [state, action] = useActionState(createTicketAction, initialState);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    defaultCompanyId ?? companies[0]?.id ?? "",
  );
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId ?? "");
  const [selectedBoardId, setSelectedBoardId] = useState(defaultBoardId ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      id: project.id,
      label: `${project.code} · ${project.name}`,
      code: project.code,
      name: project.name,
    }));
  }, [projects]);

  const availableTeams = useMemo(() => {
    return teams.filter((team) => team.companyId === selectedCompanyId);
  }, [teams, selectedCompanyId]);

  const availableBoards = useMemo(() => {
    return boards.filter((board) => board.teamId === selectedTeamId);
  }, [boards, selectedTeamId]);

  useEffect(() => {
    if (!availableTeams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(availableTeams[0]?.id ?? "");
    }
  }, [availableTeams, selectedTeamId]);

  useEffect(() => {
    if (!availableBoards.some((board) => board.id === selectedBoardId)) {
      setSelectedBoardId(availableBoards[0]?.id ?? "");
    }
  }, [availableBoards, selectedBoardId]);

  function selectProjectByQuery(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      setSelectedProjectId("");
      return;
    }

    const matched = projectOptions.find((project) => {
      return (
        project.label.toLowerCase() === normalizedQuery ||
        project.code.toLowerCase() === normalizedQuery ||
        project.name.toLowerCase() === normalizedQuery
      );
    });

    setSelectedProjectId(matched?.id ?? "");
  }

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }

      return [...current, userId];
    });
  }

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {defaultParentTicketId && (
        <input
          type="hidden"
          name="parentTicketId"
          value={defaultParentTicketId}
        />
      )}

      {defaultParentTicketId && (
        <p className="md:col-span-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
          This ticket will be created as a subtask of the selected parent
          ticket.
        </p>
      )}

      <div className="md:col-span-2">
        <label
          htmlFor="companyId"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Company
        </label>
        <select
          id="companyId"
          name="companyId"
          value={selectedCompanyId}
          onChange={(event) => {
            setSelectedCompanyId(event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          required
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="teamId"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Team
        </label>
        <select
          id="teamId"
          name="teamId"
          value={selectedTeamId}
          onChange={(event) => {
            setSelectedTeamId(event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          required
        >
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="boardId"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Board
        </label>
        <select
          id="boardId"
          name="boardId"
          value={selectedBoardId}
          onChange={(event) => {
            setSelectedBoardId(event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          required
        >
          {availableBoards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Ticket title
        </label>
        <input
          id="title"
          name="title"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          placeholder="API authentication flow broken"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          placeholder="Describe expected behavior, impact and reproduction steps"
        />
      </div>

      <div>
        <label
          htmlFor="projectId"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Project
        </label>
        <input
          id="projectId"
          list="ticket-project-options"
          value={projectSearch}
          onChange={(event) => {
            const nextValue = event.target.value;
            setProjectSearch(nextValue);
            selectProjectByQuery(nextValue);
          }}
          onBlur={(event) => {
            selectProjectByQuery(event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          placeholder="Type project code or name"
        />
        <datalist id="ticket-project-options">
          {projectOptions.map((project) => (
            <option key={project.id} value={project.label} />
          ))}
        </datalist>
        <input type="hidden" name="projectId" value={selectedProjectId} />
        <p className="mt-1 text-xs text-slate-500">
          Leave empty to keep the ticket without project.
        </p>
      </div>

      <div>
        <label
          htmlFor="assignedToIds"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Assignees
        </label>
        <div
          id="assignedToIds"
          className="flex flex-wrap gap-2 rounded-lg border border-slate-300 p-2"
        >
          {members.map((member) => {
            const selected = selectedAssigneeIds.includes(member.userId);
            return (
              <button
                key={member.userId}
                type="button"
                onClick={() => toggleAssignee(member.userId)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                title={member.fullName}
              >
                {member.fullName}
              </button>
            );
          })}
        </div>
        {selectedAssigneeIds.map((userId) => (
          <input
            key={`assigned-${userId}`}
            type="hidden"
            name="assignedToIds"
            value={userId}
          />
        ))}
        <p className="mt-1 text-xs text-slate-500">
          Click once to add/remove assignees.
        </p>
      </div>

      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="BACKLOG"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          <option value="BACKLOG">Backlog</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="DONE">Done</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="workflowStage"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Work stage
        </label>
        <select
          id="workflowStage"
          name="workflowStage"
          defaultValue="NEW"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
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
          htmlFor="priority"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="MEDIUM"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="estimatedHours"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Estimated hours
        </label>
        <input
          id="estimatedHours"
          name="estimatedHours"
          type="number"
          step="0.5"
          min={0}
          defaultValue={0}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        />
      </div>

      <div>
        <label
          htmlFor="dueDate"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Due date
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        />
      </div>

      {state.error && (
        <p className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <div className="md:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (window.location.href = "/tickets")}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 outline-none ring-blue-500 transition focus:ring-2 hover:bg-slate-50"
        >
          Cancel
        </button>
        <SubmitButton idleLabel="Create Ticket" busyLabel="Creating..." />
      </div>
    </form>
  );
}
