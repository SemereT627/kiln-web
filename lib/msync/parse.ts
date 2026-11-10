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
export const BANK_SENDERS: string[] = ["Awash Bank", "AwashBank"];

const amount = (s: string) => Number(s.replace(/,/g, ""));

/**
 * CBE: "Dear X You have received ETB 6,300.00 from account 1**7228 (Payer
 * Name) to your account 1**2968. Your current balance is … https://mbreciept.cbe.com.et/<id> …"
 * The receipt link id is unique per transfer, so it's the reference.
 */
const cbe: Parser = (_sender, body) => {
  if (!/Thanks for Banking with CBE/i.test(body)) return null;
  const m = body.match(/You have received ETB ([\d,]+(?:\.\d+)?) from account \S+ \(([^)]+)\)/i);
  if (!m) return { kind: "other", bank: "CBE", amount: null, currency: null, payer: null, reference: null };
  return {
    kind: "credit",
    bank: "CBE",
    amount: amount(m[1]),
    currency: "ETB",
    payer: m[2].trim(),
    reference: body.match(/mbreciept\.cbe\.com\.et\/(\S+)/i)?.[1] ?? null,
  };
};

/**
 * Awash: "Dear Customer, your Account 01347xxxxxx8500 has been Credited with
 * ETB 22200.00 on 2026-11-03 17:37:28 by SELF. Your balance now is …"
 * No transaction id in the text; the SMS fingerprint dedupes repeats.
 */
const awash: Parser = (_sender, body) => {
  if (!/Awash Bank/i.test(body)) return null;
  const m = body.match(/has been Credited with ETB ([\d,]+(?:\.\d+)?) on [\d-]+ [\d:]+ by (.+?)\. Your balance/i);
  if (!m) return { kind: "other", bank: "Awash", amount: null, currency: null, payer: null, reference: null };
  return { kind: "credit", bank: "Awash", amount: amount(m[1]), currency: "ETB", payer: m[2].trim(), reference: null };
};

const PARSERS: Parser[] = [cbe, awash];

export function parseMessage(sender: string, body: string): Parsed {
  for (const parse of PARSERS) {
    const result = parse(sender, body);
    if (result) return result;
  }
  return { kind: "unparsed", bank: null, amount: null, currency: null, payer: null, reference: null };
}
