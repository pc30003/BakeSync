import { cn, formatGrams } from "@/lib/utils";

interface StockLevelBarProps {
  current: number;
  reorder: number;
  critical: number;
  label?: string;
  className?: string;
}

export function StockLevelBar({ current, reorder, critical, label, className }: StockLevelBarProps) {
  // "Full" is the higher of 2x reorder or current stock — so the bar never looks under-filled after restock
  const full = Math.max(reorder * 2, current);
  const pct  = full > 0 ? Math.min(100, (current / full) * 100) : 0;

  const color =
    current <= 0       ? "bg-gray-300" :
    current <= critical ? "bg-red-500" :
    current <= reorder  ? "bg-yellow-400" :
    "bg-green-500";

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{formatGrams(current)}</span>
        </div>
      )}
      <div
        className="h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={full}
        aria-label={label ? `${label}: ${formatGrams(current)}` : formatGrams(current)}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
