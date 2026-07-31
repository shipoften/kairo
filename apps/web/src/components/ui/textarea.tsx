import { cn } from "@/lib/cn";
import {
  controlClassName,
  type ControlSize,
} from "./control";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: ControlSize;
  invalid?: boolean;
};

export function Textarea({
  className,
  size = "md",
  invalid = false,
  placeholder,
  ...props
}: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        controlClassName({ size, invalid }),
        "min-h-24 resize-y",
        className,
      )}
      placeholder={placeholder}
      {...props}
    />
  );
}
