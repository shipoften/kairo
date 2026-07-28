"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function MarkReadButton({
  notificationId,
  label,
}: {
  notificationId: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <Button type="button" variant="link" size="sm" onClick={async () => {
        await apiFetch(`/v1/notifications/${notificationId}/read`, {
          method: "POST",
        });
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
