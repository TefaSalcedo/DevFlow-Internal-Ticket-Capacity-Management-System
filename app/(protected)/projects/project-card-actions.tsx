"use client";

import { useState, useTransition } from "react";

import { deleteProjectAction, updateProjectAction } from "@/app/(protected)/projects/actions";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";

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

interface ProjectCardActionsProps {
  project: {
    id: string;
    company_id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    icon: string | null;
  };
}

export function ProjectCardActions({ project }: ProjectCardActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(project.icon);
  const [showPicker, setShowPicker] = useState(false);

  function onSubmitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await updateProjectAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setEditing(false);
    });
  }

  function onDelete() {
    setShowDeleteModal(true);
  }

  function onConfirmDelete() {
    const formData = new FormData();
    formData.set("projectId", project.id);
    formData.set("companyId", project.company_id);
    setError(null);

    startTransition(async () => {
      const result = await deleteProjectAction(formData);
      if (result?.error) {
        setError(result.error);
      }
      setShowDeleteModal(false);
    });
  }

  if (!editing) {
    return (
      <>
        <ConfirmDeleteModal
          open={showDeleteModal}
          title="Delete project"
          description={`Are you sure you want to delete "${project.name}"? All associated tickets will also be removed. This action cannot be undone.`}
          confirmLabel="Delete project"
          isPending={isPending}
          onConfirm={onConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            disabled={isPending}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
            disabled={isPending}
          >
            Delete
          </button>
          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>
      </>
    );
  }

  return (
    <form
      onSubmit={onSubmitUpdate}
      className="mt-4 space-y-2 rounded-md border border-slate-200 p-3"
    >
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="companyId" value={project.company_id} />
      <input type="hidden" name="icon" value={selectedIcon ?? ""} />

      <div>
        <label htmlFor={`project-name-${project.id}`} className="mb-1 block text-xs text-slate-500">
          Name
        </label>
        <input
          id={`project-name-${project.id}`}
          name="name"
          defaultValue={project.name}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor={`project-code-${project.id}`} className="mb-1 block text-xs text-slate-500">
          Code
        </label>
        <input
          id={`project-code-${project.id}`}
          name="code"
          defaultValue={project.code}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm uppercase"
          required
        />
      </div>

      <div>
        <label
          htmlFor={`project-status-${project.id}`}
          className="mb-1 block text-xs text-slate-500"
        >
          Status
        </label>
        <select
          id={`project-status-${project.id}`}
          name="status"
          defaultValue={project.status}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div>
        <p className="mb-1 text-xs text-slate-500">Icon</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-base transition hover:bg-slate-50"
          >
            {selectedIcon ?? "🗂️"}
          </button>
          {selectedIcon && (
            <button
              type="button"
              onClick={() => setSelectedIcon(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Remove
            </button>
          )}
        </div>
        {showPicker && (
          <div className="mt-1 flex flex-wrap gap-1 rounded border border-slate-200 bg-white p-1.5 shadow-sm">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setSelectedIcon(emoji);
                  setShowPicker(false);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-slate-100 ${
                  selectedIcon === emoji ? "bg-slate-200 ring-2 ring-slate-400" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-700">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
          disabled={isPending}
        >
          Save
        </button>
      </div>
    </form>
  );
}
