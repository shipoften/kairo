import { cn } from "@/lib/cn";
import {
  controlClassName,
  type ControlSize,
} from "./control";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  size?: ControlSize;
  invalid?: boolean;
};

export function Input({
  className,
  size = "md",
  invalid = false,
  placeholder,
  ...props
}: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClassName({ size, invalid, className }))}
      placeholder={placeholder}
      {...props}
    />
  );
}
