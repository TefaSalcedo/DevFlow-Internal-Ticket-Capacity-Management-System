import clsx from "clsx";

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className }: ProgressBarProps) {
  const ratio = max <= 0 ? 0 : Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div
        className={clsx(
          "h-full rounded-full transition-all",
          ratio >= 100 ? "bg-rose-500" : ratio >= 80 ? "bg-amber-500" : "bg-emerald-500"
        )}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}
