import { describe, expect, test } from "bun:test";
import {
  availableLocalesFromMap,
  buildLocalizedMapFromPrimary,
  Locales,
  normalizeLocalizedMap,
  resolveLocalizedString,
} from "@xs-share/shared";

describe("task localized copy helpers", () => {
  test("normalize keeps supported locales only", () => {
    expect(
      normalizeLocalizedMap({
        en: " Hello ",
        zh: "你好",
        fr: "Bonjour",
        bad: 1,
      }),
    ).toEqual({
      en: "Hello",
      zh: "你好",
    });
  });

  test("resolve prefers requested locale then source", () => {
    const map = { en: "English", zh: "中文" };
    expect(resolveLocalizedString(map, "zh", "en")).toBe("中文");
    expect(resolveLocalizedString(map, "fr", "en")).toBe("English");
    expect(resolveLocalizedString({}, "zh", "en", "legacy")).toBe("legacy");
  });

  test("available locales and primary builder", () => {
    expect(availableLocalesFromMap({ en: "a", zh: " " })).toEqual([Locales.en]);
    expect(buildLocalizedMapFromPrimary("Title", "zh")).toEqual({
      zh: "Title",
    });
  });
});
