"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

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

    setProfile({
      id: user.id,
      full_name: data?.full_name ?? null,
      role: data?.role ?? "viewer",
      locale: data?.locale ?? "en-US",
      email: user.email ?? null,
    });

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
