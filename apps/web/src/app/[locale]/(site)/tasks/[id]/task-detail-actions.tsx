import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { buildLoginPath } from "@/lib/login-redirect";
import { JoinButton } from "./join-button";

type TaskDetailActionsProps = {
  taskId: string;
  publisherId: string;
  submitDeadlineHours: number;
  joinDisabled: boolean;
  joinDisabledReason?: string;
  myJoinId: string | null;
  me: { id: string } | null;
};

export async function TaskDetailActions({
  taskId,
  publisherId,
  submitDeadlineHours,
  joinDisabled,
  joinDisabledReason,
  myJoinId,
  me,
}: TaskDetailActionsProps) {
  const t = await getTranslations("tasks");

  if (!me) {
    return (
      <ButtonLink href={buildLoginPath(`/tasks/${taskId}`)} fullWidth>
        {t("loginToJoin")}
      </ButtonLink>
    );
  }

  if (me.id === publisherId) {
    return (
      <ButtonLink
        href={`/publish/tasks/${taskId}/submissions`}
        variant="secondary"
        fullWidth
      >
        {t("manageTask")}
      </ButtonLink>
    );
  }

  if (myJoinId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">{t("alreadyJoined")}</p>
        <ButtonLink href="/earn/joins" variant="secondary" fullWidth>
          {t("viewMyJoin")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <JoinButton
      taskId={taskId}
      label={t("join")}
      confirmMessage={t("joinConfirm", { hours: submitDeadlineHours })}
      disabled={joinDisabled}
      disabledReason={joinDisabledReason}
    />
  );
}
