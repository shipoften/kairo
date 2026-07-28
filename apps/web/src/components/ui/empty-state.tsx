import type { IconSvgElement } from "@hugeicons/react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type EmptySize = "sm" | "md" | "lg";

const sizeClasses: Record<
  EmptySize,
  { wrap: string; iconWrap: string; icon: number; title: string; subtitle: string }
> = {
  sm: {
    wrap: "px-5 py-8",
    iconWrap: "mb-3 size-10",
    icon: 20,
    title: "text-sm",
    subtitle: "mt-1.5 text-xs",
  },
  md: {
    wrap: "px-6 py-10",
    iconWrap: "mb-4 size-12",
    icon: 24,
    title: "text-base",
    subtitle: "mt-2 text-sm",
  },
  lg: {
    wrap: "px-8 py-14",
    iconWrap: "mb-5 size-14",
    icon: 28,
    title: "text-lg",
    subtitle: "mt-2 text-sm",
  },
};

export type EmptyProps = {
  /** Hugeicons icon element */
  icon?: IconSvgElement;
  /** Optional small label above the title */
  eyebrow?: string;
  title: string;
  /** Subtitle / supporting description */
  subtitle?: string;
  /** @deprecated Prefer `subtitle` */
  description?: string;
  children?: React.ReactNode;
  size?: EmptySize;
  className?: string;
};

/**
 * Shared empty placeholder: optional icon, title, subtitle, and action slot.
 */
export function Empty({
  icon,
  eyebrow,
  title,
  subtitle,
  description,
  children,
  size = "md",
  className,
}: EmptyProps) {
  const styles = sizeClasses[size];
  const subtitleText = subtitle ?? description;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/60 text-center",
        styles.wrap,
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-2xl border border-line bg-background text-muted",
            styles.iconWrap,
          )}
        >
          <Icon icon={icon} size={styles.icon} />
        </div>
      ) : null}
      {eyebrow ? (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
          {eyebrow}
        </p>
      ) : null}
      <p className={cn("font-medium text-foreground", styles.title)}>{title}</p>
      {subtitleText ? (
        <p className={cn("max-w-sm text-muted", styles.subtitle)}>
          {subtitleText}
        </p>
      ) : null}
      {children ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use `Empty` */
export const EmptyState = Empty;
