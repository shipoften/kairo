import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
