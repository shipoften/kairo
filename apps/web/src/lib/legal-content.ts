type AppLocale = "en" | "zh";

const privacyModules = {
  en: () => import("@/content/legal/privacy.en.mdx"),
  zh: () => import("@/content/legal/privacy.zh.mdx"),
} as const;

const termsModules = {
  en: () => import("@/content/legal/terms.en.mdx"),
  zh: () => import("@/content/legal/terms.zh.mdx"),
} as const;

function resolveLocale(locale: string): AppLocale {
  return locale === "zh" ? "zh" : "en";
}

export async function loadPrivacyContent(locale: string) {
  const resolved = resolveLocale(locale);
  const content = await privacyModules[resolved]();
  return content.default;
}

export async function loadTermsContent(locale: string) {
  const resolved = resolveLocale(locale);
  const content = await termsModules[resolved]();
  return content.default;
}
