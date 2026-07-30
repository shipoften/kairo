import { getTranslations } from "next-intl/server";
import type { ProofSchema } from "@xs-share/shared";

type KnownField = "proofUrl" | "screenshot" | "note";

function resolveProofFields(schema: Record<string, unknown>): KnownField[] {
  const typed = schema as ProofSchema;
  const fields: KnownField[] = [];
  if (typed.proofUrl || schema.url) fields.push("proofUrl");
  if (typed.screenshot) fields.push("screenshot");
  if (typed.note) fields.push("note");
  if (fields.length === 0) {
    return ["proofUrl", "note"];
  }
  return fields;
}

function isRequired(
  schema: Record<string, unknown>,
  field: KnownField,
): boolean {
  const typed = schema as ProofSchema;
  if (field === "proofUrl") {
    return Boolean(typed.proofUrl?.required ?? schema.url);
  }
  return Boolean(typed[field]?.required);
}

export async function ProofRequirements({
  schema,
}: {
  schema: Record<string, unknown>;
}) {
  const t = await getTranslations("tasks");
  const tEarn = await getTranslations("earn");
  const fields = resolveProofFields(schema);

  const fieldLabels: Record<KnownField, string> = {
    proofUrl: tEarn("proofUrl"),
    screenshot: tEarn("screenshot"),
    note: tEarn("note"),
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground">
        {t("proofRequirements")}
      </h2>
      <ul className="space-y-2 text-sm text-muted">
        {fields.map((field) => (
          <li key={field} className="flex gap-2">
            <span className="text-accent" aria-hidden>
              ·
            </span>
            <span>
              {fieldLabels[field]}
              {isRequired(schema, field) ? ` (${t("required")})` : ""}
            </span>
          </li>
        ))}
      </ul>
      {Object.keys(schema).length === 0 ? (
        <p className="text-xs text-muted">{t("proofDefaultHint")}</p>
      ) : null}
    </section>
  );
}
