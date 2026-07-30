"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export function EditTaskForm({
  taskId,
  initialTitle,
  initialDescription,
  initialTargetUrl,
}: {
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  initialTargetUrl: string;
}) {
  const t = useTranslations("publish");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const targetUrlId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, targetUrl }),
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
        className="flex flex-col gap-4"
      >
        <FormField label={t("fieldTitle")} htmlFor={titleId}>
          <Input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("placeholderTitle")}
            required
          />
        </FormField>
        <FormField label={t("fieldDescription")} htmlFor={descriptionId}>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("placeholderDescription")}
            rows={4}
          />
        </FormField>
        <FormField label={t("fieldTargetUrl")} htmlFor={targetUrlId}>
          <Input
            id={targetUrlId}
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder={t("placeholderTargetUrl")}
          />
        </FormField>
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
