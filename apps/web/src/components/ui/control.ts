import { cn } from "@/lib/cn";

export type ControlSize = "sm" | "md";

export const controlSizeClasses: Record<ControlSize, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-10 px-3 py-2.5 text-sm",
};

export type ControlClassNameOptions = {
  size?: ControlSize;
  invalid?: boolean;
  className?: string;
};

export function controlClassName({
  size = "md",
  invalid = false,
  className,
}: ControlClassNameOptions = {}) {
  return cn(
    "w-full rounded-xl border bg-surface text-foreground outline-none transition",
    "placeholder:text-muted",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus:border-accent",
    "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500",
    invalid ? "border-red-500 focus:border-red-500" : "border-line",
    controlSizeClasses[size],
    className,
  );
}

export function controlTriggerClassName({
  size = "md",
  invalid = false,
  className,
}: ControlClassNameOptions = {}) {
  return cn(
    controlClassName({ size, invalid }),
    "inline-flex items-center justify-between gap-2 text-left",
    className,
  );
}

export const menuSurfaceClassName =
  "fixed z-[60] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg";

export const menuItemClassName =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition";
