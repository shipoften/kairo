import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface", className)}
      {...props}
    />
  );
}

export function CardLink({
  className,
  href,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border border-line bg-surface transition hover:border-accent",
        className,
      )}
      {...props}
    />
  );
}
