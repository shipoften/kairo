import {
  ErrorCode,
  isLocale,
  LOCALE_VALUES,
  type Locale,
  type LocalizedStringMap,
  normalizeLocalizedMap,
} from "@xs-share/shared";
import { AppError } from "../lib/errors";
import { getTextModelSettings } from "./config";

type TranslateTaskCopyInput = {
  sourceLocale: Locale;
  title: string;
  description: string;
  targetLocales: Locale[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function localeLabel(locale: Locale) {
  if (locale === "zh") return "Chinese (Simplified)";
  return "English";
}

function chatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  throw new Error("Model response did not contain JSON");
}

export async function translateTaskCopy(input: TranslateTaskCopyInput) {
  const settings = await getTextModelSettings();
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new AppError(
      ErrorCode.TEXT_MODEL_NOT_CONFIGURED,
      "Text model is not configured",
      400,
      "errors.text_model_not_configured",
    );
  }

  const targets = input.targetLocales.filter(
    (locale) => locale !== input.sourceLocale,
  );
  if (targets.length === 0) {
    return {
      titleI18n: {} as LocalizedStringMap,
      descriptionI18n: {} as LocalizedStringMap,
    };
  }

  const prompt = [
    "You translate task listing copy for a marketplace app.",
    "Return ONLY valid JSON with this shape:",
    '{"translations":{"<locale>":{"title":"...","description":"..."}}}',
    "Keep meaning accurate. Preserve URLs, handles, and brand names.",
    `Source locale: ${input.sourceLocale} (${localeLabel(input.sourceLocale)})`,
    `Target locales: ${targets.map((locale) => `${locale} (${localeLabel(locale)})`).join(", ")}`,
    `Source title: ${input.title}`,
    `Source description: ${input.description || "(empty)"}`,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(settings.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a precise localization assistant. Reply with JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch {
    throw new AppError(
      ErrorCode.TEXT_MODEL_FAILED,
      "Text model request failed",
      502,
      "errors.text_model_failed",
    );
  }

  if (!response.ok) {
    throw new AppError(
      ErrorCode.TEXT_MODEL_FAILED,
      `Text model request failed (${response.status})`,
      502,
      "errors.text_model_failed",
    );
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(
      ErrorCode.TEXT_MODEL_FAILED,
      "Text model returned empty content",
      502,
      "errors.text_model_failed",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    throw new AppError(
      ErrorCode.TEXT_MODEL_FAILED,
      "Text model returned invalid JSON",
      502,
      "errors.text_model_failed",
    );
  }

  const translations =
    parsed &&
    typeof parsed === "object" &&
    "translations" in parsed &&
    parsed.translations &&
    typeof parsed.translations === "object"
      ? (parsed.translations as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  const titleI18n: LocalizedStringMap = {};
  const descriptionI18n: LocalizedStringMap = {};

  for (const locale of targets) {
    const entry = translations[locale];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.title === "string" && record.title.trim()) {
      titleI18n[locale] = record.title.trim();
    }
    if (typeof record.description === "string") {
      descriptionI18n[locale] = record.description.trim();
    }
  }

  if (Object.keys(titleI18n).length === 0) {
    throw new AppError(
      ErrorCode.TEXT_MODEL_FAILED,
      "Text model returned no translations",
      502,
      "errors.text_model_failed",
    );
  }

  return {
    titleI18n: normalizeLocalizedMap(titleI18n),
    descriptionI18n: normalizeLocalizedMap(descriptionI18n),
  };
}

export function assertSupportedLocales(values: string[]): Locale[] {
  const locales: Locale[] = [];
  for (const value of values) {
    if (!isLocale(value)) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Unsupported locale: ${value}`,
        400,
      );
    }
    if (!locales.includes(value)) locales.push(value);
  }
  return locales.length > 0 ? locales : [...LOCALE_VALUES];
}
