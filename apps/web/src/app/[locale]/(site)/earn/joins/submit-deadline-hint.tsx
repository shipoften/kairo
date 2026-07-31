"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function SubmitDeadlineHint({
  deadlineAt,
}: {
  deadlineAt: string | null;
}) {
  const t = useTranslations("earn");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineAt) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  if (!deadlineAt) {
    return <p className="text-xs text-muted">{t("noSubmitDeadline")}</p>;
  }

  const end = new Date(deadlineAt).getTime();
  const remainingMs = end - now;
  if (remainingMs <= 0) {
    return (
      <p className="text-xs text-red-700">{t("submitDeadlinePassed")}</p>
    );
  }

  const hours = Math.max(1, Math.ceil(remainingMs / 3_600_000));
  return (
    <p className="text-xs text-muted">
      {t("submitDeadline")}: {new Date(deadlineAt).toLocaleString()} ·{" "}
      {t("submitDeadlineLeft", { hours })}
    </p>
  );
}
