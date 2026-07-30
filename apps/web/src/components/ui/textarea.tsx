import { cn } from "@/lib/cn";

export type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "placeholder"
> & {
  placeholder: string;
};

export function Textarea({ className, placeholder, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
      placeholder={placeholder}
    />
  );
}
