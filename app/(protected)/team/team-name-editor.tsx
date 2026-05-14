"use client";

import { useState, useTransition } from "react";

import { updateTeamAction } from "./actions";
import { DeleteTeamButton } from "./delete-team-button";

interface TeamNameEditorProps {
  teamId: string;
  companyId: string;
  teamName: string;
  canDelete?: boolean;
  canEdit?: boolean;
}

export function TeamNameEditor({
  teamId,
  companyId,
  teamName,
  canDelete,
  canEdit,
}: TeamNameEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(teamName);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        await updateTeamAction(formData);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update team name");
      }
    });
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Team name</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{teamName}</p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setName(teamName);
                  setEditing(true);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isPending}
              >
                Edit
              </button>
            )}
            {canDelete && (
              <DeleteTeamButton teamId={teamId} companyId={companyId} teamName={teamName} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={onSubmit} className="space-y-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="teamId" value={teamId} />
        <div>
          <label htmlFor={`team-name-${teamId}`} className="text-xs font-semibold text-slate-500">
            Team name
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`team-name-${teamId}`}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
              autoFocus
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(teamName);
                setEditing(false);
                setError(null);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
        </div>
      </form>
    </div>
  );
}
