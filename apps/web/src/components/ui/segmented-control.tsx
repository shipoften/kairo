"use client";

import { cn } from "@/lib/cn";
import type { ControlSize } from "./control";

export type SegmentedOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  disabled?: boolean;
  size?: ControlSize;
  className?: string;
  "aria-label"?: string;
};

const segmentSizeClasses: Record<ControlSize, string> = {
  sm: "min-h-8 px-3 py-1.5 text-xs",
  md: "min-h-9 px-3 py-2 text-sm",
};

export function SegmentedControl({
  value,
  onValueChange,
  options,
  disabled = false,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 rounded-xl border border-line bg-surface p-1",
        disabled ? "opacity-50" : "",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const optionDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={optionDisabled}
            className={cn(
              "flex-1 rounded-lg font-medium transition",
              segmentSizeClasses[size],
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
              optionDisabled ? "cursor-not-allowed" : "",
            )}
            onClick={() => {
              if (optionDisabled || active) return;
              onValueChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
