"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Total inactivity time before the user is logged out. */
const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

/** How far before the timeout to show a warning toast. */
const WARNING_BEFORE = 2 * 60 * 1000; // 2 minutes

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "visibilitychange",
] as const;

/**
 * Tracks user inactivity and automatically signs them out after TIMEOUT_DURATION.
 * A warning toast is shown WARNING_BEFORE milliseconds before the timeout.
 *
 * @param enabled  Set to true only when a user is actively logged in.
 */
export function useSessionTimeout(enabled: boolean) {
  const router = useRouter();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningToastId = useRef<string | number | null>(null);

  // Keep a stable ref so the toast action can always call the latest version.
  const resetTimerRef = useRef<() => void>(() => {});

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (warningToastId.current !== null) {
      toast.dismiss(warningToastId.current);
      warningToastId.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimers();

    // Schedule the warning toast.
    warningTimerRef.current = setTimeout(() => {
      warningToastId.current = toast.warning("Session expiring soon", {
        description: "You'll be logged out in 2 minutes due to inactivity.",
        duration: WARNING_BEFORE,
        action: {
          label: "Stay logged in",
          onClick: () => resetTimerRef.current(),
        },
      });
    }, TIMEOUT_DURATION - WARNING_BEFORE);

    // Schedule the actual logout.
    logoutTimerRef.current = setTimeout(async () => {
      if (warningToastId.current !== null) {
        toast.dismiss(warningToastId.current);
        warningToastId.current = null;
      }
      toast.error("Session expired", {
        description: "You have been logged out due to inactivity.",
      });
      await signOut();
    }, TIMEOUT_DURATION);
  }, [enabled, clearTimers, signOut]);

  // Keep the ref in sync so the toast action always has the latest function.
  useEffect(() => {
    resetTimerRef.current = resetTimer;
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    const handleActivity = () => resetTimerRef.current();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    // Kick off the timer on mount.
    resetTimer();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, [enabled, resetTimer, clearTimers]);
}
