import { getTranslations } from "next-intl/server";

const knownProofFields = ["url", "screenshot", "note"] as const;

type ProofField = (typeof knownProofFields)[number];

function resolveProofFields(schema: Record<string, unknown>): ProofField[] {
  const fields = Object.keys(schema).filter((field): field is ProofField =>
    knownProofFields.includes(field as ProofField),
  );
  if (fields.length === 0) {
    return ["url", "note"];
  }
  return fields;
}

export async function ProofRequirements({
  schema,
}: {
  schema: Record<string, unknown>;
}) {
  const t = await getTranslations("tasks");
  const tEarn = await getTranslations("earn");
  const fields = resolveProofFields(schema);

  const fieldLabels: Record<ProofField, string> = {
    url: tEarn("proofUrl"),
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
            <span>{fieldLabels[field]}</span>
          </li>
        ))}
      </ul>
      {Object.keys(schema).length === 0 ? (
        <p className="text-xs text-muted">{t("proofDefaultHint")}</p>
      ) : null}
    </section>
  );
}
