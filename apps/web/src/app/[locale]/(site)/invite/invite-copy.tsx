"use client";

import { Button } from "@/components/ui/button";

export function InviteCopyClient({ url, label }: { url: string; label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      onClick={() => navigator.clipboard.writeText(url)}
    >
      {label}
    </Button>
  );
}
