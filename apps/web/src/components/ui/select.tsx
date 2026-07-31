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
import {
  controlTriggerClassName,
  menuItemClassName,
  menuSurfaceClassName,
  type ControlSize,
} from "./control";
import { Icon } from "./icon";
import { syncPopoverPosition } from "./popover-position";

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
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: ControlSize;
  invalid?: boolean;
  "aria-label"?: string;
};

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
    syncPopoverPosition(anchorElement, listRef.current, { matchWidth: true });
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
      className={cn(menuSurfaceClassName, "max-h-60 overflow-y-auto")}
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
              menuItemClassName,
              "justify-between",
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
  size = "md",
  invalid = false,
  "aria-label": ariaLabel,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-listbox`;
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(-1);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? placeholder ?? "";

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
    const startPosition =
      currentPosition >= 0 ? currentPosition : direction === 1 ? -1 : 0;
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
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={controlTriggerClassName({
          size,
          invalid,
          className: cn(
            !selectedOption && placeholder ? "text-muted" : "",
            className,
          ),
        })}
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
          className={cn("shrink-0 text-muted transition", open ? "rotate-180" : "")}
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
