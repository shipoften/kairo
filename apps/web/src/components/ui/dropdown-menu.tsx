"use client";

import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
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
import { Button } from "./button";
import { menuItemClassName, menuSurfaceClassName } from "./control";
import { Icon } from "./icon";
import { syncPopoverPosition } from "./popover-position";

export type DropdownMenuItem = {
  id?: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export type DropdownMenuProps = {
  items: DropdownMenuItem[];
  trigger?: React.ReactNode;
  align?: "start" | "end";
  "aria-label"?: string;
  className?: string;
};

export function DropdownMenu({
  items,
  trigger,
  align = "end",
  "aria-label": ariaLabel,
  className,
}: DropdownMenuProps) {
  const generatedId = useId();
  const menuId = `${generatedId}-menu`;
  const [open, setOpen] = useState(false);
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);

  const updatePosition = useCallback(() => {
    if (!anchorElement || !menuRef.current) return;
    syncPopoverPosition(anchorElement, menuRef.current, {
      matchWidth: false,
      maxHeight: 280,
    });
    if (align === "end") {
      const rect = anchorElement.getBoundingClientRect();
      const width = menuRef.current.offsetWidth;
      menuRef.current.style.left = `${Math.max(8, rect.right - width)}px`;
    }
  }, [align, anchorElement]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectItem = useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      if (!item || item.disabled) return;
      item.onSelect();
      closeMenu();
      anchorElement?.focus();
    },
    [anchorElement, closeMenu],
  );

  const moveHighlight = useCallback((direction: 1 | -1) => {
    const enabled = itemsRef.current
      .map((item, index) => (item.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (enabled.length === 0) return;
    const currentPosition = enabled.indexOf(activeIndexRef.current);
    const startPosition =
      currentPosition >= 0 ? currentPosition : direction === 1 ? -1 : 0;
    const nextPosition =
      (startPosition + direction + enabled.length) % enabled.length;
    setActiveIndex(enabled[nextPosition] ?? -1);
  }, []);

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
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        anchorElement?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlight(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (activeIndexRef.current >= 0) {
          selectItem(activeIndexRef.current);
        }
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorElement, closeMenu, moveHighlight, open, selectItem]);

  function openMenu() {
    setActiveIndex(enabledIndexes[0] ?? -1);
    setOpen(true);
  }

  return (
    <>
      <Button
        ref={setAnchorElement}
        type="button"
        variant="ghost"
        size="sm"
        className={cn(trigger ? "px-2.5" : "size-9 px-0", className)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          openMenu();
        }}
      >
        {trigger ?? <Icon icon={MoreVerticalIcon} size={16} />}
      </Button>

      {typeof document !== "undefined" && open && anchorElement
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className={cn(menuSurfaceClassName, "min-w-44")}
            >
              {items.map((item, index) => {
                const highlighted = index === activeIndex;
                return (
                  <button
                    key={item.id ?? `${item.label}-${index}`}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={cn(
                      menuItemClassName,
                      item.disabled
                        ? "cursor-not-allowed opacity-50"
                        : highlighted
                          ? "bg-accent/10 text-accent"
                          : "hover:bg-background",
                      item.destructive && !item.disabled
                        ? "text-red-700 hover:bg-red-50 hover:text-red-800"
                        : "",
                    )}
                    onMouseEnter={() => {
                      if (!item.disabled) setActiveIndex(index);
                    }}
                    onClick={() => selectItem(index)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
