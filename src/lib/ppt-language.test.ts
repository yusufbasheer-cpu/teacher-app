import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_LANGUAGE,
  PPT_STRINGS,
  PRESENTATION_LANGUAGES,
  defaultLanguageForSubject,
  fontFaceFor,
  isPresentationLanguage,
  isRtlLanguage,
  localeTagFor,
  resolvePresentationLanguage,
} from "./ppt-language";

describe("resolvePresentationLanguage", () => {
  it("honours an explicit selection over the subject", () => {
    // The whole point of the field: a teacher choosing Arabic for a Science lesson must not be
    // overridden by the old subject-derived inference.
    expect(resolvePresentationLanguage({ language: "ar", subject: "Science" })).toBe("ar");
    expect(resolvePresentationLanguage({ language: "en", subject: "Arabic" })).toBe("en");
  });

  it("falls back to the subject when no language is given", () => {
    // Preserves the pre-existing behaviour for lessons saved before the field existed.
    expect(resolvePresentationLanguage({ subject: "Arabic" })).toBe("ar");
    expect(resolvePresentationLanguage({ subject: "Math" })).toBe("en");
  });

  it("ignores an invalid language rather than trusting it", () => {
    expect(resolvePresentationLanguage({ language: "fr", subject: "Math" })).toBe("en");
    expect(resolvePresentationLanguage({ language: 42, subject: "Arabic" })).toBe("ar");
    expect(resolvePresentationLanguage({ language: null, subject: "Math" })).toBe("en");
  });

  it("defaults to English with no information at all", () => {
    expect(resolvePresentationLanguage({})).toBe(DEFAULT_PRESENTATION_LANGUAGE);
    expect(DEFAULT_PRESENTATION_LANGUAGE).toBe("en");
  });
});

describe("helpers", () => {
  it("validates language codes", () => {
    expect(isPresentationLanguage("ar")).toBe(true);
    expect(isPresentationLanguage("EN")).toBe(false);
    expect(isPresentationLanguage(undefined)).toBe(false);
  });

  it("defaults a new form's language from the subject", () => {
    expect(defaultLanguageForSubject("Arabic")).toBe("ar");
    expect(defaultLanguageForSubject("French")).toBe("en");
    expect(defaultLanguageForSubject(undefined)).toBe("en");
  });

  it("marks only Arabic as RTL and maps locales", () => {
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("en")).toBe(false);
    expect(localeTagFor("ar")).toBe("ar-AE");
    expect(localeTagFor("en")).toBe("en-GB");
  });

  it("swaps in an Arabic-capable face only for Arabic", () => {
    expect(fontFaceFor("en", "Calibri")).toBe("Calibri");
    expect(fontFaceFor("ar", "Calibri")).not.toBe("Calibri");
  });
});

describe("static string table", () => {
  it("has a translation for every key in every language", () => {
    const keys = Object.keys(PPT_STRINGS.en);
    for (const lang of PRESENTATION_LANGUAGES) {
      for (const key of keys) {
        const value = PPT_STRINGS[lang][key as keyof (typeof PPT_STRINGS)["en"]];
        expect(value, `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it("has no English text left in the Arabic table", () => {
    // Guards the actual failure mode: a new string added to `en` and copy-pasted into `ar`.
    // Deliberately not a blanket "no Latin characters" rule — that would be wrong for real
    // Arabic content containing acronyms or names.
    for (const [key, value] of Object.entries(PPT_STRINGS.ar)) {
      expect(value, `ar.${key}`).not.toBe(
        PPT_STRINGS.en[key as keyof (typeof PPT_STRINGS)["en"]],
      );
      expect(value, `ar.${key} should contain Arabic script`).toMatch(/[؀-ۿ]/);
    }
  });
});
