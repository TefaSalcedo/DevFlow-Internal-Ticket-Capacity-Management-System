"use client";

import { useActionState, useMemo, useState } from "react";
import { type CreateTicketState, createTicketAction } from "@/app/(protected)/tickets/new/actions";
import { SubmitButton } from "@/components/ui/submit-button";

interface TicketFormProps {
  companies: Array<{
    id: string;
    name: string;
  }>;
  projects: Array<{
    id: string;
    companyId: string;
    code: string;
    name: string;
  }>;
  members: Array<{
    userId: string;
    fullName: string;
    companyId: string;
  }>;
  teams: Array<{
    id: string;
    companyId: string;
    name: string;
  }>;
  defaultCompanyId?: string;
}

const initialState: CreateTicketState = {};

export function TicketForm({
  companies,
  projects,
  members,
  teams,
  defaultCompanyId,
}: TicketFormProps) {
  const [state, action] = useActionState(createTicketAction, initialState);
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId ?? "");

  const scopedProjects = useMemo(() => {
    if (!selectedCompanyId) {
      return projects;
    }

    return projects.filter((project) => project.companyId === selectedCompanyId);
  }, [projects, selectedCompanyId]);

  const scopedTeams = useMemo(() => {
    if (!selectedCompanyId) {
      return teams;
    }

    return teams.filter((team) => team.companyId === selectedCompanyId);
  }, [teams, selectedCompanyId]);

  const scopedMembers = useMemo(() => {
    if (!selectedCompanyId) {
      return members;
    }

    return members.filter((member) => member.companyId === selectedCompanyId);
  }, [members, selectedCompanyId]);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="companyId" className="mb-1 block text-sm font-medium text-slate-700">
          Company
        </label>
        <select
          id="companyId"
          name="companyId"
          value={selectedCompanyId}
          onChange={(event) => setSelectedCompanyId(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
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
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
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
        <label htmlFor="projectId" className="mb-1 block text-sm font-medium text-slate-700">
          Project
        </label>
        <select
          id="projectId"
          name="projectId"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          defaultValue=""
        >
          <option value="">Unassigned project</option>
          {scopedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="teamId" className="mb-1 block text-sm font-medium text-slate-700">
          Team
        </label>
        <select
          id="teamId"
          name="teamId"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          defaultValue=""
        >
          <option value="">Unassigned team</option>
          {scopedTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="assignedToIds" className="mb-1 block text-sm font-medium text-slate-700">
          Assignees
        </label>
        <select
          id="assignedToIds"
          name="assignedToIds"
          multiple
          className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          {scopedMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.fullName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Use Ctrl/Cmd + click to select multiple people.
        </p>
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
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
          <option value="BUG">Bug</option>
          <option value="DESIGN">Design</option>
          <option value="DONE">Done</option>
        </select>
      </div>

      <div>
        <label htmlFor="workflowStage" className="mb-1 block text-sm font-medium text-slate-700">
          Work stage
        </label>
        <select
          id="workflowStage"
          name="workflowStage"
          defaultValue="DEVELOPMENT"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          <option value="DEVELOPMENT">DEV</option>
          <option value="QA">QA</option>
          <option value="PR_REVIEW">PR Review</option>
        </select>
      </div>

      <div>
        <label htmlFor="priority" className="mb-1 block text-sm font-medium text-slate-700">
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
        <label htmlFor="estimatedHours" className="mb-1 block text-sm font-medium text-slate-700">
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
        <label htmlFor="dueDate" className="mb-1 block text-sm font-medium text-slate-700">
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

      <div className="md:col-span-2 flex justify-end">
        <SubmitButton idleLabel="Create Ticket" busyLabel="Creating..." />
      </div>
    </form>
  );
}
