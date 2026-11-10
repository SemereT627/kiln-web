import { createHash, randomBytes, randomInt } from "node:crypto";

// No 0/O, 1/I/L: the code is read off a screen and typed on a phone.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** 8 characters shown as ABCD-EFGH; ~40 bits, valid 10 minutes, single use. */
export function newPairCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export function normalizePairCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function newDeviceKey() {
  return `msk_${randomBytes(32).toString("base64url")}`;
}
