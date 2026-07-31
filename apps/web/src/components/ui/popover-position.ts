export function syncPopoverPosition(
  anchorElement: HTMLElement,
  popoverElement: HTMLElement,
  options?: {
    maxHeight?: number;
    gap?: number;
    viewportPadding?: number;
    matchWidth?: boolean;
  },
) {
  const {
    maxHeight = 240,
    gap = 4,
    viewportPadding = 8,
    matchWidth = true,
  } = options ?? {};

  const rect = anchorElement.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const openUpward = spaceBelow < maxHeight && spaceAbove > spaceBelow;
  const availableSpace = (openUpward ? spaceAbove : spaceBelow) - gap;
  const resolvedMaxHeight = Math.min(maxHeight, Math.max(availableSpace, 0));

  popoverElement.style.maxHeight = `${resolvedMaxHeight}px`;

  if (matchWidth) {
    popoverElement.style.width = `${rect.width}px`;
    popoverElement.style.minWidth = "";
  } else {
    popoverElement.style.width = "";
    popoverElement.style.minWidth = `${Math.max(rect.width, 160)}px`;
  }

  const width = popoverElement.offsetWidth || rect.width;
  popoverElement.style.left = `${Math.min(
    rect.left,
    window.innerWidth - width - viewportPadding,
  )}px`;

  const height = popoverElement.offsetHeight;
  if (openUpward) {
    popoverElement.style.top = `${rect.top - height - gap}px`;
  } else {
    popoverElement.style.top = `${rect.bottom + gap}px`;
  }
}
