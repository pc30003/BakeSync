import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function Card({ children, className, as: Component = "div" }: CardProps) {
  return (
    <Component className={cn("bg-card border border-border rounded-xl shadow-sm", className)}>
      {children}
    </Component>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4 border-b border-border", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-base font-semibold text-foreground", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-3 border-t border-border bg-muted/30 rounded-b-xl", className)}>
      {children}
    </div>
  );
}
