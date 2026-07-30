"use client";

import { Calendar01Icon } from "@hugeicons/core-free-icons";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatDateTime,
  mergeDateAndTime,
  startOfDay,
  startOfMonth,
} from "@/lib/datetime";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Calendar, getInitialCalendarMonth } from "./calendar";
import { FormField } from "./form-field";
import { Icon } from "./icon";
import { Select } from "./select";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => ({
  value: String(index),
  label: String(index).padStart(2, "0"),
}));

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => ({
  value: String(index),
  label: String(index).padStart(2, "0"),
}));

export type DateTimePickerProps = {
  value?: Date | null;
  onChange?: (value: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder: string;
  "aria-label"?: string;
};

function syncPopoverPosition(
  anchorElement: HTMLElement,
  panelElement: HTMLDivElement,
) {
  const rect = anchorElement.getBoundingClientRect();
  const panelHeight = panelElement.offsetHeight;
  const viewportPadding = 8;
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const openUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow;

  panelElement.style.left = `${Math.min(
    rect.left,
    window.innerWidth - panelElement.offsetWidth - viewportPadding,
  )}px`;
  panelElement.style.width = `${Math.max(rect.width, 300)}px`;

  if (openUpward) {
    panelElement.style.top = `${rect.top - panelHeight - 4}px`;
  } else {
    panelElement.style.top = `${rect.bottom + 4}px`;
  }
}

function isSelectDropdownTarget(target: Node) {
  return (target as Element).closest?.("[data-ui-select-listbox]") !== null;
}

function DateTimePickerPanel({
  open,
  anchorElement,
  panelId,
  value,
  minDate,
  maxDate,
  locale,
  onSelect,
  onClear,
  onClose,
}: {
  open: boolean;
  anchorElement: HTMLElement | null;
  panelId: string;
  value: Date | null;
  minDate?: Date;
  maxDate?: Date;
  locale: string;
  onSelect: (value: Date | null) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("common.calendar");
  const hourId = useId();
  const minuteId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => getInitialCalendarMonth(value, minDate));
  const [hour, setHour] = useState(() => String(value?.getHours() ?? 23));
  const [minute, setMinute] = useState(() => String(value?.getMinutes() ?? 59));

  const updatePosition = useCallback(() => {
    if (!anchorElement || !panelRef.current) return;
    syncPopoverPosition(anchorElement, panelRef.current);
  }, [anchorElement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorElement?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (isSelectDropdownTarget(target)) return;
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        anchorElement?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorElement, onClose, open]);

  function resolveBaseDate() {
    return value ?? startOfDay(new Date());
  }

  function applyTimeParts(nextHour: string, nextMinute: string) {
    const hourValue = Math.min(23, Math.max(0, Number(nextHour) || 0));
    const minuteValue = Math.min(59, Math.max(0, Number(nextMinute) || 0));
    const next = resolveBaseDate();
    next.setHours(hourValue, minuteValue, 0, 0);
    onSelect(next);
  }

  function handleHourChange(nextHour: string) {
    setHour(nextHour);
    applyTimeParts(nextHour, minute);
  }

  function handleMinuteChange(nextMinute: string) {
    setMinute(nextMinute);
    applyTimeParts(hour, nextMinute);
  }

  function handleDaySelect(day: Date) {
    const next = mergeDateAndTime(day, value);
    const hourValue = Math.min(23, Math.max(0, Number(hour) || 0));
    const minuteValue = Math.min(59, Math.max(0, Number(minute) || 0));
    next.setHours(hourValue, minuteValue, 0, 0);
    onSelect(next);
  }

  function handleToday() {
    const today = startOfDay(new Date());
    if (minDate && today < startOfDay(minDate)) return;
    if (maxDate && today > startOfDay(maxDate)) return;
    const next = new Date(today);
    next.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
    onSelect(next);
    setMonth(startOfMonth(today));
  }

  if (typeof document === "undefined" || !open || !anchorElement) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={t("title")}
      className="fixed z-50 rounded-xl border border-line bg-surface p-4 shadow-lg"
    >
      <Calendar
        month={month}
        onMonthChange={setMonth}
        selected={value}
        onSelect={handleDaySelect}
        locale={locale}
        minDate={minDate}
        maxDate={maxDate}
        prevMonthLabel={t("prevMonth")}
        nextMonthLabel={t("nextMonth")}
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-xs font-medium text-muted">{t("time")}</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("hour")} htmlFor={hourId}>
            <Select
              id={hourId}
              aria-label={t("hour")}
              placeholder={t("hour")}
              value={hour}
              options={HOUR_OPTIONS}
              onValueChange={handleHourChange}
            />
          </FormField>
          <FormField label={t("minute")} htmlFor={minuteId}>
            <Select
              id={minuteId}
              aria-label={t("minute")}
              placeholder={t("minute")}
              value={minute}
              options={MINUTE_OPTIONS}
              onValueChange={handleMinuteChange}
            />
          </FormField>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={handleToday}>
          {t("today")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t("clear")}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

export function DateTimePicker({
  value = null,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  id,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const locale = useLocale();
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const panelId = `${triggerId}-panel`;
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelSeed, setPanelSeed] = useState(0);

  const displayValue = value ? formatDateTime(value, locale) : placeholder;

  return (
    <>
      <button
        ref={setAnchorElement}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-50",
          !value ? "text-muted" : "text-foreground",
          className,
        )}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setPanelSeed((current) => current + 1);
          }
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{displayValue}</span>
        <Icon icon={Calendar01Icon} size={16} className="text-muted" />
      </button>

      <DateTimePickerPanel
        key={panelSeed}
        open={open}
        anchorElement={anchorElement}
        panelId={panelId}
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        locale={locale}
        onSelect={(next) => onChange?.(next)}
        onClear={() => {
          onChange?.(null);
          setOpen(false);
          anchorElement?.focus();
        }}
        onClose={() => {
          setOpen(false);
          anchorElement?.focus();
        }}
      />
    </>
  );
}
