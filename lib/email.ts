import { Resend } from "resend";

/**
 * Transactional email via Resend. Sending never throws — callers treat email
 * as best-effort so a mail outage can't fail the request that triggered it;
 * failures are logged and reported back as `{ ok: false }`.
 *
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL (e.g. "Kiln <noreply@yourdomain>").
 */
let client: Resend | null = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean }> {
  const resend = getClient();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) {
    console.error("sendEmail: RESEND_API_KEY or RESEND_FROM_EMAIL is not set");
    return { ok: false };
  }
  try {
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) {
      console.error("sendEmail: Resend rejected the message", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("sendEmail: request to Resend failed", err);
    return { ok: false };
  }
}

/** Public base URL for links in emails. */
export function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

// ── Templates ──────────────────────────────────────────────────────────
// Colours mirror the app's light-theme tokens in app/globals.css (converted
// from oklch to hex, which every email client understands).

const C = {
  page: "#f5f5f5", // --muted
  card: "#ffffff", // --card
  border: "#e5e5e5", // --border
  text: "#0a0a0a", // --foreground
  muted: "#5b5b5b", // --muted-foreground
  primary: "#b35025", // --primary (Kiln terracotta)
  onPrimary: "#fafafa", // --primary-foreground
};
const FONT = "Poppins,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const P = `margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.text};`;

// Images in email must be absolute and publicly reachable — a localhost
// URL would be broken for every recipient, so fall back to production.
const LOGO_URL = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://kiln.semere.app").replace(/\/$/, "")}/logo-192.png`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Table-based layout with inline styles — email clients (Outlook
 * especially) ignore <style> blocks, classes and most div styling. */
function layout(body: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};font-family:${FONT};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:0 4px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${LOGO_URL}" width="28" height="28" alt="" style="display:block;border:0;border-radius:6px;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-size:18px;font-weight:700;color:${C.text};">Kiln</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px;">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:${C.muted};">
          Kiln · Ceramic stock management
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td style="border-radius:10px;background:${C.primary};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.onPrimary};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function footnote(text: string) {
  return `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${C.muted};">${text}</p>`;
}

export function requestReceivedEmail(fullName: string) {
  const name = escapeHtml(fullName);
  return {
    subject: "We received your Kiln access request",
    html: layout(`
      <p style="${P}">Hi ${name},</p>
      <p style="${P}margin-bottom:0;">Thanks for requesting access to Kiln. An administrator will review it, and you'll get another email once it's approved.</p>
      ${footnote("If you didn't request this, you can ignore this email.")}`),
    text: `Hi ${fullName},\n\nThanks for requesting access to Kiln. An administrator will review it, and you'll get another email once it's approved.\n\nIf you didn't request this, you can ignore this email.`,
  };
}

export function adminNewRequestEmail({
  fullName,
  email,
  message,
  reviewUrl,
}: {
  fullName: string;
  email: string;
  message: string | null;
  reviewUrl: string;
}) {
  return {
    subject: `New access request from ${fullName}`,
    html: layout(`
      <p style="${P}"><strong>${escapeHtml(fullName)}</strong> (<a href="mailto:${escapeHtml(email)}" style="color:${C.primary};text-decoration:none;">${escapeHtml(email)}</a>) requested access to Kiln.</p>
      ${message ? `<p style="${P}padding:12px 16px;background:${C.page};border-radius:10px;white-space:pre-wrap;">${escapeHtml(message)}</p>` : ""}
      ${button(reviewUrl, "Review request")}`),
    text: `${fullName} (${email}) requested access to Kiln.\n${message ? `\n"${message}"\n` : ""}\nReview it: ${reviewUrl}`,
  };
}

export function inviteEmail({
  fullName,
  role,
  inviteUrl,
}: {
  fullName: string;
  role: string;
  inviteUrl: string;
}) {
  const roleLabel = role === "seller" ? "seller" : "viewer";
  return {
    subject: "Your Kiln access is approved",
    html: layout(`
      <p style="${P}">Hi ${escapeHtml(fullName)},</p>
      <p style="${P}">Your access request was approved — you've been added as a <strong>${roleLabel}</strong>. Set a password to finish setting up your account.</p>
      ${button(inviteUrl, "Set your password")}
      ${footnote("This link works once and expires after a while. If it stops working, ask an administrator to send a new one.")}`),
    text: `Hi ${fullName},\n\nYour access request was approved — you've been added as a ${roleLabel}. Set a password to finish setting up your account:\n\n${inviteUrl}\n\nThis link works once and expires after a while. If it stops working, ask an administrator to send a new one.`,
  };
}

export function requestRejectedEmail(fullName: string) {
  return {
    subject: "Your Kiln access request",
    html: layout(`
      <p style="${P}">Hi ${escapeHtml(fullName)},</p>
      <p style="${P}margin-bottom:0;">Your request for access to Kiln wasn't approved. If you think this is a mistake, please contact the store administrator directly.</p>`),
    text: `Hi ${fullName},\n\nYour request for access to Kiln wasn't approved. If you think this is a mistake, please contact the store administrator directly.`,
  };
}
