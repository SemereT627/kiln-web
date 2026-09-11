/**
 * Deterministic color for initials-based avatars. Picks from a fixed palette
 * that deliberately avoids the app's semantic hues (success=emerald,
 * warning=amber, destructive=red) so a user's avatar never accidentally
 * reads as a status indicator elsewhere on the page.
 */
const AVATAR_PALETTE = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
] as const;

/** Same seed always maps to the same palette entry (simple string hash). */
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function getInitials(name: string | null | undefined): string {
  const source = (name ?? "").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
