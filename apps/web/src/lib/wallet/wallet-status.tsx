import { Badge } from "@/components/ui/badge";

export function ledgerTypeKey(type: string) {
  return `ledger.${type}` as const;
}

export function depositStatusVariant(
  status: string,
): "accent" | "warning" | "muted" | "danger" {
  if (status === "confirmed") return "accent";
  if (status === "confirming" || status === "detecting") return "warning";
  if (status === "ignored") return "danger";
  return "muted";
}

export function withdrawStatusVariant(
  status: string,
): "accent" | "warning" | "muted" | "danger" {
  if (status === "paid") return "accent";
  if (status === "pending" || status === "approved") return "warning";
  if (status === "rejected") return "danger";
  return "muted";
}

export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "accent" | "warning" | "muted" | "danger" | "default";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}

export function formatWalletDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
