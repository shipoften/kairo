import { cn } from "@/lib/cn";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "placeholder"
> & {
  placeholder: string;
};

export function Input({ className, placeholder, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
      placeholder={placeholder}
    />
  );
}
