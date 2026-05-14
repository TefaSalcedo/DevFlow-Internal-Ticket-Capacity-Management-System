"use client";

import { useEffect, useRef } from "react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  open,
  title = "Delete confirmation",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmLabel = "Delete",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-description"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {/* Icon */}
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-rose-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 id="confirm-delete-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p id="confirm-delete-description" className="mt-1 text-sm text-slate-500">
          {description}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
