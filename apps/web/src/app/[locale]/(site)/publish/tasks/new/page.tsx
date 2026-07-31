"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Locales, proofSchemaForTaskType } from "@xs-share/shared";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { displayUsdt, usdtToMicros } from "@/lib/money";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import {
  emptyTaskCopy,
  TaskCopyFields,
  type TaskCopyState,
} from "../task-copy-fields";

const TYPES = [
  "x_follow",
  "x_like",
  "x_repost",
  "x_post",
  "cpa_register",
  "custom",
] as const;

export default function NewTaskPage() {
  const t = useTranslations("publish");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const typeId = useId();
  const targetUrlId = useId();
  const unitPriceId = useId();
  const quotaId = useId();
  const endsAtId = useId();
  const submitHoursId = useId();
  const reviewHoursId = useId();

  const initialSource = locale === Locales.zh ? Locales.zh : Locales.en;
  const [copy, setCopy] = useState<TaskCopyState>(() =>
    emptyTaskCopy(initialSource),
  );
  const [type, setType] = useState<(typeof TYPES)[number]>("x_follow");
  const [targetUrl, setTargetUrl] = useState("");
  const [unitPriceUsdt, setUnitPriceUsdt] = useState(1);
  const [totalQuota, setTotalQuota] = useState(10);
  const [submitDeadlineHours, setSubmitDeadlineHours] = useState(72);
  const [reviewDeadlineHours, setReviewDeadlineHours] = useState(72);
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [platformFeeRateBps, setPlatformFeeRateBps] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const meta = await apiFetch<{ platformFeeRateBps?: number }>(
          "/v1/public/meta",
        );
        if (typeof meta.platformFeeRateBps === "number") {
          setPlatformFeeRateBps(meta.platformFeeRateBps);
        }
      } catch {
        // keep default 0
      }
    })();
  }, []);

  const unitPriceMicros = usdtToMicros(unitPriceUsdt);
  const baseMicros = unitPriceMicros * totalQuota;
  const feeMicros = Math.floor((baseMicros * platformFeeRateBps) / 10_000);
  const freezeMicros = baseMicros + feeMicros;

  const typeOptions = useMemo(
    () =>
      TYPES.map((item) => ({
        value: item,
        label: tTasks(`types.${item}`),
      })),
    [tTasks],
  );

  const proofTemplate = useMemo(() => proofSchemaForTaskType(type), [type]);
  const proofSummary = useMemo(() => {
    return Object.entries(proofTemplate).map(([field, requirement]) => ({
      field,
      required: Boolean(requirement?.required),
    }));
  }, [proofTemplate]);

  async function submit(publish: boolean) {
    if (!copy.titleI18n[copy.sourceLocale]?.trim()) {
      setError(t("missingPrimaryTitle"));
      return;
    }
    if (publish && !confirmed) {
      setError(t("confirmFreezeRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ task: { id: string } }>("/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          titleI18n: copy.titleI18n,
          descriptionI18n: copy.descriptionI18n,
          sourceLocale: copy.sourceLocale,
          type,
          targetUrl: targetUrl || undefined,
          unitPriceMicros,
          totalQuota,
          submitDeadlineHours,
          reviewDeadlineHours,
          allowResubmit,
          endsAt: endsAt ? endsAt.toISOString() : undefined,
          publish,
        }),
      });
      router.push(
        publish
          ? `/publish/tasks/${result.task.id}/submissions`
          : `/publish/tasks/${result.task.id}/edit`,
      );
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title={t("create")}
        description={t("createDescription")}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
        className="flex flex-col gap-6"
      >
        <Card className="p-6">
          <FormSection
            title={t("sectionCopy")}
            description={t("sectionCopyHint")}
          >
            <TaskCopyFields value={copy} onChange={setCopy} />
          </FormSection>
        </Card>

        <Card className="p-6">
          <FormSection
            title={t("sectionBasic")}
            description={t("sectionBasicHint")}
          >
            <FormField label={t("fieldType")} htmlFor={typeId}>
              <Select
                id={typeId}
                aria-label={t("fieldType")}
                placeholder={t("placeholderType")}
                value={type}
                options={typeOptions}
                onValueChange={(value) =>
                  setType(value as (typeof TYPES)[number])
                }
              />
            </FormField>
            <div className="rounded-xl border border-line bg-background px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{t("proofRequirements")}</p>
              <ul className="mt-2 space-y-1 text-muted">
                {proofSummary.map((item) => (
                  <li key={item.field}>
                    {t(`proofField.${item.field}` as "proofField.proofUrl")}
                    {item.required ? ` (${t("proofRequired")})` : ` (${t("proofOptional")})`}
                  </li>
                ))}
              </ul>
            </div>
            <FormField label={t("fieldTargetUrl")} htmlFor={targetUrlId}>
              <Input
                id={targetUrlId}
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                placeholder={t("placeholderTargetUrl")}
              />
            </FormField>
          </FormSection>
        </Card>

        <Card className="p-6">
          <FormSection
            title={t("sectionPricing")}
            description={t("sectionPricingHint")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("fieldUnitPrice")} htmlFor={unitPriceId}>
                <Input
                  id={unitPriceId}
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPriceUsdt}
                  onChange={(event) =>
                    setUnitPriceUsdt(Number(event.target.value))
                  }
                  placeholder={t("placeholderUnitPrice")}
                />
              </FormField>
              <FormField label={t("fieldQuota")} htmlFor={quotaId}>
                <Input
                  id={quotaId}
                  type="number"
                  min={1}
                  value={totalQuota}
                  onChange={(event) =>
                    setTotalQuota(Number(event.target.value))
                  }
                  placeholder={t("placeholderQuota")}
                />
              </FormField>
            </div>
            <div className="rounded-xl bg-background px-4 py-3 text-sm">
              <p className="text-muted">{t("freezeAmount", { amount: displayUsdt(freezeMicros) })}</p>
              {platformFeeRateBps > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {t("freezeFeeNote", { bps: platformFeeRateBps })}
                </p>
              ) : null}
            </div>
          </FormSection>
        </Card>

        <Card className="p-6">
          <FormSection
            title={t("sectionRules")}
            description={t("sectionRulesHint")}
          >
            <FormField label={t("fieldEndsAt")} htmlFor={endsAtId}>
              <DateTimePicker
                id={endsAtId}
                value={endsAt}
                onChange={setEndsAt}
                minDate={new Date()}
                placeholder={t("placeholderEndsAt")}
                aria-label={t("fieldEndsAt")}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("fieldSubmitHours")} htmlFor={submitHoursId}>
                <Input
                  id={submitHoursId}
                  type="number"
                  min={1}
                  value={submitDeadlineHours}
                  onChange={(event) =>
                    setSubmitDeadlineHours(Number(event.target.value))
                  }
                  placeholder={t("placeholderSubmitHours")}
                />
              </FormField>
              <FormField label={t("fieldReviewHours")} htmlFor={reviewHoursId}>
                <Input
                  id={reviewHoursId}
                  type="number"
                  min={1}
                  value={reviewDeadlineHours}
                  onChange={(event) =>
                    setReviewDeadlineHours(Number(event.target.value))
                  }
                  placeholder={t("placeholderReviewHours")}
                />
              </FormField>
            </div>
            <CheckboxField
              label={t("fieldAllowResubmit")}
              checked={allowResubmit}
              onChange={(event) => setAllowResubmit(event.target.checked)}
            />
          </FormSection>
        </Card>

        <Card className="p-6">
          <FormSection
            title={t("sectionFreeze")}
            description={t("sectionFreezeHint")}
          >
            <div className="rounded-xl bg-background px-4 py-3 text-sm">
              <p className="font-medium">{t("freezeSummary")}</p>
              <p className="mt-1 text-muted">
                {t("freezeAmount", { amount: displayUsdt(freezeMicros) })}
              </p>
              {platformFeeRateBps > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {t("freezeFeeNote", { bps: platformFeeRateBps })}
                </p>
              ) : null}
            </div>
            <CheckboxField
              label={t("freezeConfirm")}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={loading}>
                {t("createAndPublish")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                onClick={() => void submit(false)}
              >
                {t("saveDraft")}
              </Button>
            </div>
          </FormSection>
        </Card>
      </form>
    </main>
  );
}
