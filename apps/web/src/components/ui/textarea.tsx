import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
