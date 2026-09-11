/**
 * Pure locale helpers — no server-only imports, so this is safe to use from
 * both server (i18n/request.ts) and client (LocaleSelector, UserProvider) code.
 */
export const locales = ["en", "am"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Maps a DB-stored value like "am-ET" to the next-intl locale code "am". */
export function normalizeLocale(raw: string | undefined): Locale {
  if (raw?.startsWith("am")) return "am";
  return defaultLocale;
}
