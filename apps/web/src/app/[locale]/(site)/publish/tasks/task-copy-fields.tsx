"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LOCALE_VALUES,
  Locales,
  type Locale,
  type LocalizedStringMap,
} from "@xs-share/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export type TaskCopyState = {
  sourceLocale: Locale;
  titleI18n: LocalizedStringMap;
  descriptionI18n: LocalizedStringMap;
};

export function emptyTaskCopy(sourceLocale: Locale = Locales.en): TaskCopyState {
  return {
    sourceLocale,
    titleI18n: {},
    descriptionI18n: {},
  };
}

export function TaskCopyFields({
  value,
  onChange,
}: {
  value: TaskCopyState;
  onChange: (next: TaskCopyState) => void;
}) {
  const t = useTranslations("publish");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const fieldId = useId();
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const sourceLocale = value.sourceLocale;
  const otherLocales = LOCALE_VALUES.filter(
    (locale) => locale !== sourceLocale,
  );
  const filledOtherCount = otherLocales.filter((locale) =>
    Boolean(value.titleI18n[locale]?.trim()),
  ).length;

  function setSourceField(field: "titleI18n" | "descriptionI18n", text: string) {
    onChange({
      ...value,
      [field]: {
        ...value[field],
        [sourceLocale]: text,
      },
    });
  }

  async function fillWithAi() {
    setTranslateError(null);
    const sourceTitle = (value.titleI18n[sourceLocale] ?? "").trim();
    if (!sourceTitle) {
      setTranslateError(t("aiTranslateNeedSource"));
      return;
    }

    setTranslating(true);
    try {
      const result = await apiFetch<{
        titleI18n: LocalizedStringMap;
        descriptionI18n: LocalizedStringMap;
      }>("/v1/tasks/translate", {
        method: "POST",
        body: JSON.stringify({
          sourceLocale,
          title: sourceTitle,
          description: value.descriptionI18n[sourceLocale] ?? "",
          targetLocales: otherLocales,
        }),
      });
      onChange({
        ...value,
        titleI18n: {
          ...value.titleI18n,
          ...result.titleI18n,
          [sourceLocale]: sourceTitle,
        },
        descriptionI18n: {
          ...value.descriptionI18n,
          ...result.descriptionI18n,
          [sourceLocale]: value.descriptionI18n[sourceLocale] ?? "",
        },
      });
      setOthersOpen(true);
    } catch (err) {
      setTranslateError(
        resolveApiErrorMessage(err, tCommon, t("aiTranslateFailed")),
      );
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            {tTasks(`languages.${sourceLocale}`)}
            {` · ${t("sourceLocaleBadge")}`}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={translating}
            onClick={() => void fillWithAi()}
          >
            {t("aiFillOtherLocales")}
          </Button>
        </div>
        <FormField label={t("fieldTitle")} htmlFor={`${fieldId}-title`}>
          <Input
            id={`${fieldId}-title`}
            value={value.titleI18n[sourceLocale] ?? ""}
            onChange={(event) => setSourceField("titleI18n", event.target.value)}
            placeholder={t("placeholderTitle")}
            required
          />
        </FormField>
        <FormField
          label={t("fieldDescription")}
          htmlFor={`${fieldId}-description`}
        >
          <Textarea
            id={`${fieldId}-description`}
            value={value.descriptionI18n[sourceLocale] ?? ""}
            onChange={(event) =>
              setSourceField("descriptionI18n", event.target.value)
            }
            placeholder={t("placeholderDescription")}
            rows={3}
          />
        </FormField>
        {translateError ? <Alert variant="error">{translateError}</Alert> : null}
      </div>

      <div className="rounded-xl border border-line bg-background">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
          aria-expanded={othersOpen}
          onClick={() => setOthersOpen((open) => !open)}
        >
          <span className="font-medium text-foreground">
            {t("otherLocalesTitle")}
          </span>
          <span className="text-muted">
            {filledOtherCount > 0
              ? t("otherLocalesFilled", { count: filledOtherCount })
              : t("otherLocalesEmpty")}
            {othersOpen ? " · −" : " · +"}
          </span>
        </button>
        {othersOpen ? (
          <div className="space-y-4 border-t border-line px-4 py-3">
            {otherLocales.map((locale) => {
              const title = value.titleI18n[locale]?.trim() ?? "";
              const description = value.descriptionI18n[locale]?.trim() ?? "";
              return (
                <div key={locale} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {tTasks(`languages.${locale}`)}
                  </p>
                  {title || description ? (
                    <>
                      <p className="text-sm text-foreground">
                        {title || t("otherLocaleTitleEmpty")}
                      </p>
                      {description ? (
                        <p className="whitespace-pre-wrap text-sm text-muted">
                          {description}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted">{t("otherLocaleEmpty")}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
