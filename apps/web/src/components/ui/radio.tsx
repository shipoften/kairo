"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export type RadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "children" | "size"
>;

export function Radio({ className, disabled, id, ...props }: RadioProps) {
  return (
    <span
      className={cn("group/radio relative inline-flex size-4 shrink-0", className)}
    >
      <input
        id={id}
        type="radio"
        disabled={disabled}
        className="absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex size-4 items-center justify-center rounded-full border border-line bg-surface transition",
          "group-has-[:focus-visible]/radio:border-accent group-has-[:focus-visible]/radio:ring-2 group-has-[:focus-visible]/radio:ring-accent/30 group-has-[:focus-visible]/radio:ring-offset-2 group-has-[:focus-visible]/radio:ring-offset-background",
          "group-has-[:checked]/radio:border-accent",
          "group-has-[:disabled]/radio:opacity-50",
          "group-has-[[aria-invalid=true]]/radio:border-red-500",
        )}
      >
        <span className="size-2 rounded-full bg-accent opacity-0 transition group-has-[:checked]/radio:opacity-100" />
      </span>
    </span>
  );
}

export function RadioField({
  label,
  description,
  className,
  id,
  ...props
}: RadioProps & {
  label: string;
  description?: string;
}) {
  const generatedId = useId();
  const radioId = id ?? generatedId;

  return (
    <label
      htmlFor={radioId}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-sm",
        props.disabled ? "cursor-not-allowed opacity-50" : "",
        className,
      )}
    >
      <Radio id={radioId} className="mt-0.5" {...props} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function RadioGroup({
  value,
  onValueChange,
  name,
  options,
  orientation = "vertical",
  className,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  options: RadioOption[];
  orientation?: "vertical" | "horizontal";
  className?: string;
  disabled?: boolean;
}) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <div
      role="radiogroup"
      className={cn(
        orientation === "horizontal"
          ? "flex flex-wrap gap-4"
          : "flex flex-col gap-2.5",
        className,
      )}
    >
      {options.map((option) => (
        <RadioField
          key={option.value}
          name={groupName}
          value={option.value}
          label={option.label}
          description={option.description}
          checked={value === option.value}
          disabled={disabled || option.disabled}
          onChange={() => onValueChange(option.value)}
        />
      ))}
    </div>
  );
}
