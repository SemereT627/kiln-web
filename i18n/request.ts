import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { normalizeLocale } from "./locale";

/**
 * This app's /en URL prefix is a cosmetic rewrite (see next.config.ts), not
 * real Next.js locale routing — every page lives at its unprefixed path.
 * So locale here comes from a cookie (synced from the user's saved
 * `user_profiles.locale`, e.g. "am-ET"), not from the URL segment.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("NEXT_LOCALE")?.value);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
