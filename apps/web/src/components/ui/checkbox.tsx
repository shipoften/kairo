"use client";

import { useId } from "react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "children" | "size"
>;

export function Checkbox({
  className,
  disabled,
  id,
  ...props
}: CheckboxProps) {
  return (
    <span
      className={cn(
        "group/checkbox relative inline-flex size-4 shrink-0",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        className="absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex size-4 items-center justify-center rounded-md border border-line bg-surface text-white transition",
          "group-has-[:focus-visible]/checkbox:border-accent group-has-[:focus-visible]/checkbox:ring-2 group-has-[:focus-visible]/checkbox:ring-accent/30 group-has-[:focus-visible]/checkbox:ring-offset-2 group-has-[:focus-visible]/checkbox:ring-offset-background",
          "group-has-[:checked]/checkbox:border-accent group-has-[:checked]/checkbox:bg-accent",
          "group-has-[:disabled]/checkbox:opacity-50",
          "group-has-[[aria-invalid=true]]/checkbox:border-red-500",
        )}
      >
        <Icon
          icon={Tick02Icon}
          size={12}
          className="opacity-0 transition group-has-[:checked]/checkbox:opacity-100"
        />
      </span>
    </span>
  );
}

export function CheckboxField({
  label,
  description,
  className,
  id,
  ...props
}: CheckboxProps & {
  label: string;
  description?: string;
}) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-sm",
        props.disabled ? "cursor-not-allowed opacity-50" : "",
        className,
      )}
    >
      <Checkbox id={checkboxId} className="mt-0.5" {...props} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
