"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

function syncDropdownPosition(
  anchorElement: HTMLElement,
  listElement: HTMLUListElement,
) {
  const rect = anchorElement.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 4;
  const maxListHeight = 240;

  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const openUpward = spaceBelow < maxListHeight && spaceAbove > spaceBelow;
  const availableSpace = (openUpward ? spaceAbove : spaceBelow) - gap;
  const maxHeight = Math.min(maxListHeight, Math.max(availableSpace, 0));

  listElement.style.maxHeight = `${maxHeight}px`;
  listElement.style.width = `${rect.width}px`;
  listElement.style.left = `${Math.min(
    rect.left,
    window.innerWidth - rect.width - viewportPadding,
  )}px`;

  const listHeight = listElement.offsetHeight;

  if (openUpward) {
    listElement.style.top = `${rect.top - listHeight - gap}px`;
  } else {
    listElement.style.top = `${rect.bottom + gap}px`;
  }
}

function SelectOptionsPortal({
  open,
  anchorElement,
  listId,
  activeIndex,
  options,
  value,
  onSelect,
  onHighlight,
}: {
  open: boolean;
  anchorElement: HTMLElement | null;
  listId: string;
  activeIndex: number;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  onHighlight: (index: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  const updatePosition = useCallback(() => {
    if (!anchorElement || !listRef.current) return;
    syncDropdownPosition(anchorElement, listRef.current);
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

  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    const item = listRef.current?.children.item(activeIndex) as HTMLElement | null;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (typeof document === "undefined" || !open || !anchorElement) {
    return null;
  }

  return createPortal(
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      className="fixed z-[60] max-h-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
      data-ui-select-listbox=""
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const highlighted = index === activeIndex;

        return (
          <li
            key={option.value || `option-${index}`}
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled || undefined}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition",
              option.disabled
                ? "cursor-not-allowed opacity-50"
                : highlighted
                  ? "bg-accent/10 text-accent"
                  : "hover:bg-background",
              selected && !highlighted ? "text-accent" : "",
            )}
            onMouseEnter={() => {
              if (!option.disabled) onHighlight(index);
            }}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              if (option.disabled) return;
              onSelect(option.value);
            }}
          >
            <span className="truncate">{option.label}</span>
            {selected ? <Icon icon={Tick02Icon} size={16} className="text-accent" /> : null}
          </li>
        );
      })}
    </ul>,
    document.body,
  );
}

export function Select({
  options,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  placeholder,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-listbox`;
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(-1);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  const selectableIndexes = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);

  function setValue(nextValue: string) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  function closeList() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function openList() {
    if (disabled) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (selectableIndexes[0] ?? -1));
    setOpen(true);
  }

  function selectOption(nextValue: string) {
    setValue(nextValue);
    closeList();
    anchorElement?.focus();
  }

  function moveHighlight(direction: 1 | -1) {
    if (selectableIndexes.length === 0) return;
    const currentPosition = selectableIndexes.indexOf(activeIndex);
    const startPosition = currentPosition >= 0 ? currentPosition : direction === 1 ? -1 : 0;
    const nextPosition =
      (startPosition + direction + selectableIndexes.length) %
      selectableIndexes.length;
    setActiveIndex(selectableIndexes[nextPosition] ?? -1);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorElement?.contains(target)) return;
      if (document.getElementById(listId)?.contains(target)) return;
      closeList();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeList();
        anchorElement?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorElement, listId, open]);

  return (
    <>
      <button
        ref={setAnchorElement}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-50",
          !selectedOption && placeholder ? "text-muted" : "",
          className,
        )}
        onClick={() => {
          if (open) {
            closeList();
            return;
          }
          openList();
        }}
        onKeyDown={(event) => {
          if (disabled) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              openList();
              return;
            }
            moveHighlight(1);
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              openList();
              return;
            }
            moveHighlight(-1);
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) {
              openList();
              return;
            }
            const option = options[activeIndex];
            if (option && !option.disabled) {
              selectOption(option.value);
            }
          }
        }}
      >
        <span className="truncate">{displayLabel}</span>
        <Icon
          icon={ArrowDown01Icon}
          size={16}
          className={cn("text-muted transition", open ? "rotate-180" : "")}
        />
      </button>

      <SelectOptionsPortal
        open={open}
        anchorElement={anchorElement}
        listId={listId}
        activeIndex={activeIndex}
        options={options}
        value={value}
        onSelect={selectOption}
        onHighlight={setActiveIndex}
      />
    </>
  );
}
