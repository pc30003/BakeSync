import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button onClick={action.onClick} size="sm">{action.label}</Button>
        </div>
      )}
    </div>
  );
}
