import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "danger";
export type ButtonSize = "xs" | "sm" | "md";

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
};

const variantClasses: Record<Exclude<ButtonVariant, "link">, string> = {
  primary: "border border-transparent bg-accent text-white hover:bg-accent/90",
  secondary:
    "border border-line bg-background text-foreground hover:border-accent hover:bg-surface",
  ghost:
    "border border-transparent text-muted hover:bg-background hover:text-foreground",
  danger: "border border-transparent bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "min-h-8 px-3 py-1.5 text-xs",
  sm: "min-h-9 px-4 py-2 text-sm",
  md: "min-h-10 px-5 py-2.5 text-sm",
};

const linkSizeClasses: Record<ButtonSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
};

export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleProps & {
  className?: string;
} = {}) {
  if (variant === "link") {
    return cn(
      "inline-flex items-center justify-center gap-1.5 font-normal leading-none text-accent transition hover:text-accent/80",
      "focus-visible:outline-none focus-visible:underline",
      "disabled:pointer-events-none disabled:opacity-50",
      linkSizeClasses[size],
      fullWidth && "w-full",
      className,
    );
  }

  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium leading-none transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
}
