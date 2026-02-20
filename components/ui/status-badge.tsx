import clsx from "clsx";

interface StatusBadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  );
}
