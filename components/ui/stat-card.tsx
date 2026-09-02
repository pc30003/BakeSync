import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { CountUp } from "./count-up";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: "default" | "warning" | "danger" | "success";
  className?: string;
}

const variantBorder: Record<string, string> = {
  default: "border-border",
  warning: "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/20",
  danger:  "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
  success: "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20",
};

const variantIcon: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  danger:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

/**
 * Decide how to render the value:
 *  - plain number            → count up
 *  - integer with a % suffix → count up + "%"
 *  - anything else (e.g. "7.9 kg") → render as-is (don't mangle units/decimals)
 */
function renderValue(value: string | number) {
  if (typeof value === "number") {
    return <CountUp value={value} />;
  }
  const pctMatch = /^(\d+)%$/.exec(value.trim());
  if (pctMatch) {
    return <CountUp value={parseInt(pctMatch[1], 10)} suffix="%" />;
  }
  return value;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", variantBorder[variant], className)}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="mt-1 text-2xl font-bold text-foreground tracking-tight">
              {renderValue(value)}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "mt-1.5 text-xs font-medium",
                  trend.value >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.value >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                variantIcon[variant]
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
