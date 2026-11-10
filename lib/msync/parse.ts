/**
 * Bank SMS templates. Each parser recognises one bank's messages from the
 * sender id and text. Add banks here — phones forward raw text, so a new or
 * changed template never needs a new app build.
 */
export type Parsed = {
  kind: "credit" | "other" | "unparsed";
  bank: string | null;
  amount: number | null;
  currency: string | null;
  payer: string | null;
  reference: string | null;
};

type Parser = (sender: string, body: string) => Parsed | null;

/**
 * SMS sender ids (as the phone shows them, e.g. "CBE", "127") that phones
 * forward. Sent to phones on pairing and every heartbeat, so adding a bank
 * here reaches them within ~15 minutes. Everything else stays on the phone.
 */
export const BANK_SENDERS: string[] = [];

// Filled in once real sample messages per bank are collected.
const PARSERS: Parser[] = [];

export function parseMessage(sender: string, body: string): Parsed {
  for (const parse of PARSERS) {
    const result = parse(sender, body);
    if (result) return result;
  }
  return { kind: "unparsed", bank: null, amount: null, currency: null, payer: null, reference: null };
}
