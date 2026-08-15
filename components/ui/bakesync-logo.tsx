import Image from "next/image";
import { cn } from "@/lib/utils";

interface BakeSyncLogoProps {
  /** Show just the icon mark, or the full lockup */
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const iconSizes = { sm: 32, md: 40, lg: 56 };
const fullSizes = { sm: 100, md: 140, lg: 200 };

export function BakeSyncLogo({ variant = "icon", size = "md", className }: BakeSyncLogoProps) {
  const px = variant === "icon" ? iconSizes[size] : fullSizes[size];

  return (
    <Image
      src="/icons/logo-source.jpeg"
      alt="BakeSync"
      width={px}
      height={variant === "icon" ? px : Math.round(px * 0.45)}
      className={cn("object-contain", className)}
      priority
    />
  );
}
