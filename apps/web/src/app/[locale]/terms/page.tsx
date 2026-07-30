import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadTermsContent } from "@/lib/legal-content";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const Content = await loadTermsContent(locale);

  return (
    <main className="flex flex-1 flex-col gap-6 py-4">
      <p className="text-sm text-muted">{t("termsMeta")}</p>
      <article className="legal-prose max-w-3xl">
        <Content />
      </article>
    </main>
  );
}
