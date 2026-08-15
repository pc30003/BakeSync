import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

interface UserAvatarProps {
  user: Pick<SessionUser, "name" | "image" | "email">;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name ?? "User avatar"}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center shrink-0",
        sizes[size],
        className
      )}
      aria-label={user.name ?? "User"}
    >
      {initials}
    </div>
  );
}
