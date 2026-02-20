"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { type CreateProjectState, createProjectAction } from "./actions";

interface ProjectFormProps {
  companies: Array<{
    id: string;
    name: string;
  }>;
  defaultCompanyId?: string;
}

const initialState: CreateProjectState = {};

export function ProjectForm({ companies, defaultCompanyId }: ProjectFormProps) {
  const [state, action] = useActionState(createProjectAction, initialState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="companyId" className="mb-1 block text-sm font-medium text-slate-700">
          Company
        </label>
        <select
          id="companyId"
          name="companyId"
          defaultValue={defaultCompanyId ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          required
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Project name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
          placeholder="Customer Portal Revamp"
        />
      </div>

      <div>
        <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
          Project code
        </label>
        <input
          id="code"
          name="code"
          required
          maxLength={20}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 transition focus:ring-2"
          placeholder="PORTAL"
        />
        <p className="mt-1 text-xs text-slate-500">
          Use short uppercase codes (e.g. CRM, API, APP-MOBILE).
        </p>
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
          Initial status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="ACTIVE"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
        >
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {state.error && (
        <p className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <div className="md:col-span-2 flex justify-end">
        <SubmitButton idleLabel="Create Project" busyLabel="Creating..." />
      </div>
    </form>
  );
}
