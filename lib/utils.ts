import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a number with thousands separators and a fixed decimal count (e.g. 334820 -> "334,820.00"). */
export function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Formats a quantity with its measurement unit (e.g. 153.28, "m²" -> "153.28 m²"). */
export function formatQuantity(value: number, unit = "m²") {
  return `${formatNumber(value)} ${unit}`
}

/** Formats an ETB amount with thousands separators (e.g. 334820 -> "334,820.00 ETB"). */
export function formatETB(value: number) {
  return `${formatNumber(value)} ETB`
}

/**
 * Human-readable date, e.g. "26 Aug 2026" — use this instead of raw
 * toLocaleDateString()/`8/26/2026` wherever a date is displayed in the UI.
 */
export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Same as formatDate, plus the time (e.g. "26 Aug 2026, 6:02 PM"). */
export function formatDateTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
