import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:   "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success:   "bg-green-100 text-green-800",
  warning:   "bg-yellow-100 text-yellow-800",
  danger:    "bg-red-100 text-red-800",
  info:      "bg-blue-100 text-blue-800",
  outline:   "border border-border bg-transparent text-foreground",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
