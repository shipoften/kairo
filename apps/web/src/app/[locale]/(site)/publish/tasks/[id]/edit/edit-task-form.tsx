"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Locales,
  type LocalizedStringMap,
} from "@xs-share/shared";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import {
  TaskCopyFields,
  type TaskCopyState,
} from "../../task-copy-fields";

export function EditTaskForm({
  taskId,
  initialTitleI18n,
  initialDescriptionI18n,
  initialSourceLocale,
  initialTargetUrl,
}: {
  taskId: string;
  initialTitleI18n: LocalizedStringMap;
  initialDescriptionI18n: LocalizedStringMap;
  initialSourceLocale: string;
  initialTargetUrl: string;
}) {
  const t = useTranslations("publish");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [copy, setCopy] = useState<TaskCopyState>({
    sourceLocale:
      initialSourceLocale === Locales.zh ? Locales.zh : Locales.en,
    titleI18n: initialTitleI18n,
    descriptionI18n: initialDescriptionI18n,
  });
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!copy.titleI18n[copy.sourceLocale]?.trim()) {
      setError(t("missingPrimaryTitle"));
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          titleI18n: copy.titleI18n,
          descriptionI18n: copy.descriptionI18n,
          sourceLocale: copy.sourceLocale,
          targetUrl,
        }),
      });
      router.push("/publish/tasks");
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-6"
      >
        <FormSection
          title={t("sectionCopy")}
          description={t("sectionCopyHint")}
        >
          <TaskCopyFields value={copy} onChange={setCopy} />
        </FormSection>
        <FormSection
          title={t("sectionTargetEdit")}
          description={t("sectionTargetEditHint")}
        >
          <FormField label={t("fieldTargetUrl")} htmlFor="edit-target-url">
            <Input
              id="edit-target-url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder={t("placeholderTargetUrl")}
            />
          </FormField>
        </FormSection>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div>
          <Button type="submit" loading={loading}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
