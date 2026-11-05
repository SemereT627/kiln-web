/** Set after two-step sign-in when the user ticks "keep me signed in on this
 * device": its value is the expiry time (ms). Until then the 30-minute
 * inactivity sign-out (hooks/use-session-timeout.ts) is skipped. Same
 * mechanism as VatFlow's src/lib/device-trust.ts. */
export const TRUSTED_DEVICE_COOKIE = "trusted_until";
export const TRUSTED_DEVICE_DAYS = 30;

export function isTrustedDevice(value: string | undefined, now = Date.now()): boolean {
  return Number(value) > now;
}
