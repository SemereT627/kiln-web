/**
 * Ethiopian (Ethiopic) calendar utilities.
 *
 * Uses the `ethiopian-date` package for accurate GC ↔ EC conversion.
 *
 * API:
 *   ethiopianDate.toEthiopian(YYYY, MM, DD) → [ethYear, ethMonth, ethDay]
 *   ethiopianDate.toGregorian(YYYY, MM, DD) → [gcYear, gcMonth, gcDay]
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ethiopianDate = require("ethiopian-date");

const ETH_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miyazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
] as const;

/**
 * Convert a Gregorian Date to an Ethiopian calendar display string.
 * e.g. new Date("2026-02-23") → "Yekatit 16, 2018 E.C."
 */
export function formatEthiopian(date: Date): string {
  const [ethYear, ethMonth, ethDay]: [number, number, number] =
    ethiopianDate.toEthiopian(
      date.getFullYear(),
      date.getMonth() + 1, // toEthiopian expects 1-indexed month
      date.getDate(),
    );
  const monthName = ETH_MONTHS[ethMonth - 1] ?? `Month ${ethMonth}`;
  return `${monthName} ${ethDay}, ${ethYear} E.C.`;
}

/**
 * Parse a date string in DD/MM/YYYY Ethiopian calendar format and return
 * the equivalent Gregorian Date (local midnight).
 *
 * e.g. "16/06/2018" → Date representing 2026-02-23
 */
export function parseEthiopianDate(dateStr: string): Date {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid Ethiopian date: "${dateStr}"`);
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Non-numeric parts in Ethiopian date: "${dateStr}"`);
  }
  const [gcYear, gcMonth, gcDay]: [number, number, number] =
    ethiopianDate.toGregorian(year, month, day);
  // Return local midnight so sales records match the correct calendar day
  return new Date(gcYear, gcMonth - 1, gcDay);
}
