"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { deleteTeamAction } from "./actions";

interface DeleteTeamButtonProps {
  teamId: string;
  companyId: string;
  teamName: string;
}

export function DeleteTeamButton({ teamId, companyId, teamName }: DeleteTeamButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("companyId", companyId);
    setError(null);

    startTransition(async () => {
      try {
        await deleteTeamAction(formData);
        // Solo cerrar el modal después de completar exitosamente
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete team");
      }
    });
  }

  return (
    <>
      <ConfirmDeleteModal
        open={open}
        title="Delete team"
        description={`Are you sure you want to delete "${teamName}"? All team assignments will be removed. This action cannot be undone.`}
        confirmLabel="Delete team"
        isPending={isPending}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="rounded-md p-1 text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
        title="Delete team"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </>
  );
}
