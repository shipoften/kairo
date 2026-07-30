export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isBeforeDay(left: Date, right: Date) {
  return startOfDay(left).getTime() < startOfDay(right).getTime();
}

export function isAfterDay(left: Date, right: Date) {
  return startOfDay(left).getTime() > startOfDay(right).getTime();
}

export function mergeDateAndTime(date: Date, timeSource: Date | null, fallbackHour = 23, fallbackMinute = 59) {
  const next = new Date(date);
  if (timeSource) {
    next.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  } else {
    next.setHours(fallbackHour, fallbackMinute, 0, 0);
  }
  return next;
}

export function getWeekdayLabels(locale: string, weekStartsOn: 0 | 1 = 1) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const baseSunday = new Date(2024, 0, 7);
  const labels: string[] = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(baseSunday);
    date.setDate(baseSunday.getDate() + ((index + weekStartsOn) % 7));
    labels.push(formatter.format(date));
  }

  return labels;
}

export function getCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function formatDateTime(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
