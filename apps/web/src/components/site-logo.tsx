import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function SiteLogo({
  name,
  showName = true,
  size = 32,
  className,
}: {
  name: string;
  showName?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2.5 text-foreground", className)}
      aria-label={name}
    >
      <Image
        src="/logo.svg"
        alt=""
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {showName ? (
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
          {name}
        </span>
      ) : null}
    </Link>
  );
}
