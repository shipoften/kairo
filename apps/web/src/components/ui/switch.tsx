"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  value?: string;
  className?: string;
  "aria-label"?: string;
};

export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  id,
  name,
  value = "on",
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const checked =
    controlledChecked !== undefined ? controlledChecked : uncontrolledChecked;

  function setChecked(next: boolean) {
    if (controlledChecked === undefined) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition",
        checked ? "border-accent bg-accent" : "border-line bg-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
      onClick={() => {
        if (disabled) return;
        setChecked(!checked);
      }}
    >
      {name ? (
        <input
          type="hidden"
          name={name}
          value={checked ? value : ""}
          disabled={disabled}
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 size-4 rounded-full bg-surface shadow-sm transition",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export function SwitchField({
  label,
  description,
  className,
  id,
  ...props
}: SwitchProps & {
  label: string;
  description?: string;
}) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 text-sm",
        props.disabled ? "opacity-50" : "",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          <label htmlFor={switchId}>{label}</label>
        </p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      <Switch id={switchId} {...props} />
    </div>
  );
}
