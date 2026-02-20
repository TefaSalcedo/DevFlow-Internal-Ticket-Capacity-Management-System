"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  idleLabel: string;
  busyLabel: string;
}

export function SubmitButton({ idleLabel, busyLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busyLabel : idleLabel}
    </button>
  );
}
