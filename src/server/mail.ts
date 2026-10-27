import { randomUUID } from "node:crypto";
import { db } from "./db";
import { mailOutbox } from "./db/schema";
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export async function queueMail(to: string, subject: string, html: string) {
  await db.insert(mailOutbox).values({ id: randomUUID(), to, subject, html });
}
export const roleLabel = (role: string) =>
  ({ owner: "proprietar", admin: "administrator", moderator: "moderator" })[
    role
  ] ?? role;

type EmailOptions = {
  /** Small uppercase label above the title, e.g. "CONFIRMARE EMAIL". */
  eyebrow?: string;
  title?: string;
  /** Muted line under the button; omit for transactional updates. */
  note?: string;
};

const font = "Montserrat,'Helvetica Neue',Arial,sans-serif";

/**
 * Branded single-action email. Table layout and inline styles only, so it
 * renders the same in Gmail, Outlook and Apple Mail.
 */
export function linkEmail(
  message: string,
  url: string,
  label: string,
  { eyebrow, title, note }: EmailOptions = {},
) {
  const href = escapeHtml(url);
  const body = escapeHtml(message).replace(/\n/g, "<br>");
  const siteUrl = escapeHtml(
    (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, ""),
  );
  const site = siteUrl.replace(/^https?:\/\//, "");
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(title ?? label)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f9f7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(message)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f9f7">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 24px;font-family:${font};font-size:26px;font-weight:800;letter-spacing:-1.2px;color:#002626">
hai<span style="color:#0f5a52">moldova</span><span style="color:#c0705f">.</span>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #dfe9e2;border-radius:16px;padding:36px 32px">
${eyebrow ? `<p style="margin:0 0 10px;font-family:${font};font-size:10px;font-weight:800;letter-spacing:2px;color:#5f795f;text-transform:uppercase">${escapeHtml(eyebrow)}</p>` : ""}
${title ? `<h1 style="margin:0 0 14px;font-family:${font};font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.4px;color:#002626">${escapeHtml(title)}</h1>` : ""}
<p style="margin:0 0 28px;font-family:${font};font-size:15px;line-height:1.6;font-weight:400;color:#17332d">${body}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:9px;background:#002626">
<a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:13px;font-weight:700;letter-spacing:0.2px;color:#ffffff;text-decoration:none;border-radius:9px">${escapeHtml(label)}</a>
</td></tr></table>
${note ? `<p style="margin:28px 0 0;font-family:${font};font-size:12px;line-height:1.6;color:#647a75">${escapeHtml(note)}</p>` : ""}
<p style="margin:${note ? "12px" : "28px"} 0 0;padding-top:20px;border-top:1px solid #e4efea;font-family:${font};font-size:11px;line-height:1.6;color:#647a75">
Dacă butonul nu funcționează, copiază acest link în browser:<br>
<a href="${href}" target="_blank" style="color:#0f5a52;word-break:break-all">${href}</a>
</p>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-family:${font};font-size:10px;font-weight:800;letter-spacing:2px;color:#5f795f">
LOCURI MICI. POVEȘTI MARI.
</td></tr>
${site ? `<tr><td align="center" style="padding:6px 16px 0;font-family:${font};font-size:11px;color:#647a75"><a href="${siteUrl}" target="_blank" style="color:#647a75;text-decoration:none">${site}</a></td></tr>` : ""}
</table>
</td></tr>
</table>
</body>
</html>`;
}
