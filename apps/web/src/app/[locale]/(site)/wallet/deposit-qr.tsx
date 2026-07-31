"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function DepositQr({
  address,
  label,
}: {
  address: string;
  label: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const url = await QRCode.toDataURL(address, {
        width: 200,
        margin: 2,
        color: { dark: "#111111", light: "#ffffff" },
      });
      if (!cancelled) setDataUrl(url);
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!dataUrl) {
    return (
      <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-line bg-bg text-sm text-muted">
        …
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={label}
      width={200}
      height={200}
      className="rounded-xl border border-line bg-white p-2"
    />
  );
}
