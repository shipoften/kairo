import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const brand = await getTranslations("brand");

  return (
    <main className="flex flex-1 flex-col justify-center gap-10 py-16">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Image
            src="/logo.svg"
            alt=""
            width={56}
            height={56}
            priority
            className="shrink-0"
          />
          <p className="text-sm uppercase tracking-[0.2em] text-accent">
            {brand("name")}
          </p>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-5xl leading-tight tracking-tight">
          {t("title")}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{t("subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/tasks">{t("ctaTasks")}</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          {t("ctaLogin")}
        </ButtonLink>
      </div>
    </main>
  );
}
