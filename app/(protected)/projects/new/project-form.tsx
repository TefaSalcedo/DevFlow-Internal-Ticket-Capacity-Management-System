"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { type CreateProjectState, createProjectAction } from "./actions";

const EMOJI_OPTIONS = [
  "🚀",
  "💻",
  "🐛",
  "🎨",
  "📦",
  "🔧",
  "📊",
  "🌐",
  "🔒",
  "📱",
  "⚡",
  "🎯",
  "🏗️",
  "🤖",
  "📝",
  "🔍",
  "💡",
  "🛡️",
  "🔗",
  "🌿",
];

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
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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

      <div className="md:col-span-2">
        <div className="mb-1">
          <span className="block text-sm font-medium text-slate-700">
            Icon <span className="text-slate-400 font-normal">(optional)</span>
          </span>
        </div>
        <input type="hidden" name="icon" value={selectedIcon ?? ""} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPicker((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-xl transition hover:border-slate-400 hover:bg-slate-50"
            title="Pick an icon"
          >
            {selectedIcon ?? "🗂️"}
          </button>
          {selectedIcon && (
            <button
              type="button"
              onClick={() => setSelectedIcon(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Remove icon
            </button>
          )}
        </div>
        {showPicker && (
          <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setSelectedIcon(emoji);
                  setShowPicker(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-slate-100 ${
                  selectedIcon === emoji ? "bg-slate-200 ring-2 ring-slate-400" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
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
