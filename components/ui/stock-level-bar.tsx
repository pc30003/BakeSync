import { cn, formatGrams } from "@/lib/utils";

interface StockLevelBarProps {
  current: number;
  reorder: number;
  critical: number;
  label?: string;
  className?: string;
}

export function StockLevelBar({ current, reorder, critical, label, className }: StockLevelBarProps) {
  // Display never goes below zero (stock can dip negative internally for
  // deduct/restore symmetry, but "out of stock" reads as 0 to the user).
  const displayCurrent = Math.max(0, current);
  // If stock is above reorder (healthy), show bar as nearly full
  // If below reorder, scale against reorder threshold to show how depleted it is
  let pct: number;
  if (displayCurrent >= reorder) {
    pct = 100;
  } else if (displayCurrent <= 0) {
    pct = 0;
  } else {
    pct = (displayCurrent / reorder) * 100;
  }

  const color =
    displayCurrent <= 0       ? "bg-gray-300" :
    displayCurrent <= critical ? "bg-red-500" :
    displayCurrent <= reorder  ? "bg-yellow-400" :
    "bg-green-500";

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{formatGrams(displayCurrent)}</span>
        </div>
      )}
      <div
        className="h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={displayCurrent}
        aria-valuemin={0}
        aria-valuemax={reorder}
        aria-label={label ? `${label}: ${formatGrams(displayCurrent)}` : formatGrams(displayCurrent)}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
