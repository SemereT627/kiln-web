"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { normalizeLocale } from "@/i18n/locale";

/**
 * next-intl reads the active locale from this cookie (see i18n/request.ts) —
 * the app has no [locale] URL segment, so this is the only thing that
 * actually drives which message file gets served.
 */
function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
}

function readLocaleCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("NEXT_LOCALE="))
    ?.split("=")[1];
}

type UserProfile = {
  id: string;
  full_name: string | null;
  role: "admin" | "viewer";
  locale: string;
  email: string | null;
};

type UserContextType = {
  user: UserProfile | null;
  isLoading: boolean;
  updateLocale: (locale: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  updateLocale: async () => {},
  refresh: async () => {},
});

export function useUser() {
  const context = useContext(UserContext);
  return context.user;
}

export function useUserLoading() {
  return useContext(UserContext).isLoading;
}

export function useUserActions() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  /**
   * Fetch the current user's profile from Supabase.
   *
   * @param showLoading  When true (initial load only) show the loading skeleton.
   *                     Subsequent silent re-fetches pass false to avoid flashing
   *                     the skeleton on tab focus / token refresh.
   */
  async function load(showLoading = false) {
    if (showLoading) setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, role, locale")
      .eq("id", user.id)
      .single();

    const locale = data?.locale ?? "en-US";
    setProfile({
      id: user.id,
      full_name: data?.full_name ?? null,
      role: data?.role ?? "viewer",
      locale,
      email: user.email ?? null,
    });

    // On the initial load, make sure the locale cookie next-intl reads
    // actually matches what's saved in the DB — otherwise a returning user
    // on a fresh browser would silently see English until they manually
    // reselect their language.
    if (showLoading) {
      const wanted = normalizeLocale(locale);
      const current = normalizeLocale(readLocaleCookie());
      if (wanted !== current) {
        setLocaleCookie(wanted);
        router.refresh();
      }
    }

    // Always clear the loading indicator once we have data.
    setIsLoading(false);
  }

  useEffect(() => {
    // Initial fetch — show the skeleton.
    load(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      /**
       * TOKEN_REFRESHED fires every time the browser tab regains focus because
       * Supabase silently re-issues the JWT.  INITIAL_SESSION fires right after
       * the first getUser() call.  Neither represents an actual auth-state
       * change, so we skip them to prevent flashing the loading skeleton.
       */
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT") {
        // Clear immediately — no network call needed.
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // SIGNED_IN, USER_UPDATED, etc.  Re-fetch silently.
      load(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateLocale(locale: string) {
    if (!profile) return;

    const { error } = await supabase
      .from("user_profiles")
      .update({ locale })
      .eq("id", profile.id);

    if (!error) {
      setProfile((prev) => (prev ? { ...prev, locale } : null));
      // Server components (including this one's messages) only re-resolve
      // the locale on next request — set the cookie next-intl reads, then
      // force that request.
      setLocaleCookie(normalizeLocale(locale));
      router.refresh();
    } else {
      console.error("Failed to update locale:", error);
      throw error;
    }
  }

  // Activate session-timeout tracking only while a user is logged in.
  useSessionTimeout(profile !== null);

  return (
    <UserContext.Provider
      value={{
        user: profile,
        isLoading,
        updateLocale,
        // Expose a silent refresh so callers don't trigger the skeleton.
        refresh: () => load(false),
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
