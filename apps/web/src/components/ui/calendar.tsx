"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useMemo } from "react";
import {
  addMonths,
  getCalendarDays,
  getWeekdayLabels,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  startOfMonth,
} from "@/lib/datetime";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";

export type CalendarProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected?: Date | null;
  onSelect: (date: Date) => void;
  locale: string;
  minDate?: Date;
  maxDate?: Date;
  prevMonthLabel: string;
  nextMonthLabel: string;
  className?: string;
};

export function Calendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  locale,
  minDate,
  maxDate,
  prevMonthLabel,
  nextMonthLabel,
  className,
}: CalendarProps) {
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(month),
    [locale, month],
  );
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
  const days = useMemo(() => getCalendarDays(month), [month]);
  const currentMonth = month.getMonth();

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={prevMonthLabel}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <Icon icon={ArrowLeft01Icon} size={16} />
        </Button>
        <p className="text-sm font-medium text-foreground">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={nextMonthLabel}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <Icon icon={ArrowRight01Icon} size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-1 py-1 text-center text-xs font-medium text-muted"
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === currentMonth;
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isDisabled =
            (minDate ? isBeforeDay(day, minDate) : false) ||
            (maxDate ? isAfterDay(day, maxDate) : false);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(day)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-sm transition",
                inMonth ? "text-foreground" : "text-muted/60",
                isSelected
                  ? "bg-accent text-white"
                  : "hover:bg-background",
                isToday && !isSelected ? "text-accent" : "",
                isDisabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getInitialCalendarMonth(value: Date | null | undefined, minDate?: Date) {
  if (value) return startOfMonth(value);
  if (minDate) return startOfMonth(minDate);
  return startOfMonth(new Date());
}
