import Image from "next/image";
import { cn } from "@/lib/utils";

interface BakeSyncLogoProps {
  /** "icon" = bs mark only (sidebar), "full" = full logo with text (login page) */
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const iconSizes = { sm: 32, md: 40, lg: 56, xl: 80 };
const fullSizes = { sm: 160, md: 220, lg: 300, xl: 400 };

export function BakeSyncLogo({ variant = "icon", size = "md", className }: BakeSyncLogoProps) {
  if (variant === "full") {
    const px = fullSizes[size];
    return (
      <Image
        src="/icons/BakeSync_Logo.png"
        alt="BakeSync"
        width={px}
        height={Math.round(px * 0.42)}
        className={cn("object-contain", className)}
        priority
      />
    );
  }

  // Icon mark only — used in sidebar
  const px = iconSizes[size];
  return (
    <Image
      src="/icons/BakeSync App Logo.png"
      alt="BakeSync"
      width={px}
      height={px}
      className={cn("object-contain rounded-lg", className)}
      priority
    />
  );
}
