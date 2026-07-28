import { cn } from "@/lib/cn";

type AlertVariant = "error" | "info" | "success";

const variantClasses: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-line bg-surface text-foreground",
  success: "border-accent/20 bg-accent/5 text-accent",
};

export function Alert({
  variant = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
