import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex justify-center gap-3">{children}</div> : null}
    </div>
  );
}
