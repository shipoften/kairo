"use client";

import { Chain } from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function ChainSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (chain: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("wallet");

  return (
    <SegmentedControl
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      aria-label={t("networkSelect")}
      options={[
        { value: Chain.TRC20, label: t("networkTrc20") },
        { value: Chain.ERC20, label: t("networkErc20") },
      ]}
    />
  );
}
