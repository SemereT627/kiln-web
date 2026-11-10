// Self-check for the bank parsers (no test runner in this repo):
//   node lib/msync/parse.check.ts
// Samples keep each bank's exact wording with fake names, accounts and amounts.
import assert from "node:assert/strict";
import { parseMessage } from "./parse.ts";

const cbeCredit =
  "Dear Test Owner You have received ETB 6,300.00 from account 1**1111 (Test Payer Name) to your account 1**2222. Your current balance is ETB 100,000.00. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-TESTRECEIPT00000000ab  for feedback: https://forms.gle/kGNGQpG3mQCCk3iD6";
assert.deepEqual(parseMessage("CBE", cbeCredit), {
  kind: "credit",
  bank: "CBE",
  amount: 6300,
  currency: "ETB",
  payer: "Test Payer Name",
  reference: "v2-TESTRECEIPT00000000ab",
});

const awashCredit =
  "Dear Customer, your Account 01347xxxxxx0000 has been Credited with ETB 22200.00 on 2026-11-03 17:37:28 by SELF. Your balance now is ETB 50000.00. For any complaint or enquiry, please call 8980. Subscribe to our official Telegram channel: https://t.me/awash_bank_official for more information.Please give us your feedback using this link:https://shorturl.at/WISQB Awash Bank.";
assert.deepEqual(parseMessage("AwashBank", awashCredit), {
  kind: "credit",
  bank: "Awash",
  amount: 22200,
  currency: "ETB",
  payer: "SELF",
  reference: null,
});

// A bank's other messages are recognised as that bank but not as a payment.
assert.equal(parseMessage("CBE", "Dear Test Owner your account 1**2222 has been debited with ETB 500.00. Thanks for Banking with CBE.").kind, "other");
assert.equal(parseMessage("X", "Hello, are you coming today?").kind, "unparsed");

console.log("msync parsers: all checks passed");
