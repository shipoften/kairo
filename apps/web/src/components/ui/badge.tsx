import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "accent" | "warning" | "danger" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-line bg-surface text-foreground",
  accent: "border-accent/20 bg-accent/10 text-accent",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  danger: "border-red-500/20 bg-red-500/10 text-red-700",
  muted: "border-line bg-background text-muted",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
