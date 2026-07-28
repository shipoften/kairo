import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/cn";

export function Icon({
  icon,
  size = 18,
  className,
  strokeWidth = 1.75,
}: {
  icon: IconSvgElement;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      primaryColor="currentColor"
      className={cn("shrink-0", className)}
    />
  );
}
