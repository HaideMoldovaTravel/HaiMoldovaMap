import { Resend } from "resend";
import nodemailer from "nodemailer";
import { pool } from "../src/server/db";
import {
  processNotification,
  queueModerationReminder,
} from "./worker-notifications";
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
const resend =
  process.env.MAIL_TRANSPORT !== "mailpit" && process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
const local =
  process.env.MAIL_TRANSPORT === "mailpit" &&
  process.env.APP_ENV !== "production"
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "localhost",
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: false,
      })
    : null;
if (!resend && !local)
  throw new Error("Configurează RESEND_API_KEY sau Mailpit pentru dezvoltare.");
let nextReminderCheck = 0;
while (!stopped) {
  try {
    if (Date.now() >= nextReminderCheck) {
      nextReminderCheck = Date.now() + 15 * 60000;
      await queueModerationReminder().catch(() =>
        console.error("Worker: moderation reminder check failed."),
      );
    }
    const notified = await processNotification();
    const { rows } = await pool.query(
      `UPDATE mail_outbox SET status='processing', locked_at=now(), attempts=attempts+1 WHERE id=(SELECT id FROM mail_outbox WHERE (status='pending' AND available_at<=now()) OR (status='processing' AND locked_at < now()-interval '5 minutes') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
    );
    const mail = rows[0];
    if (!mail) {
      if (!notified) await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    try {
      const message = {
        from: process.env.EMAIL_FROM ?? "Hai Moldova <noreply@localhost>",
        to: mail.recipient,
        subject: mail.subject,
        html: mail.html,
      };
      if (resend) {
        const result = await resend.emails.send(message, {
          idempotencyKey: mail.id,
        });
        if (result.error) throw new Error(result.error.name);
      } else await local!.sendMail(message);
      await pool.query(
        "UPDATE mail_outbox SET status='sent',sent_at=now(),html='',last_error=NULL WHERE id=$1",
        [mail.id],
      );
    } catch {
      // Do not log message bodies, tokens or provider responses.
      await pool.query(
        "UPDATE mail_outbox SET status=$2,available_at=now()+($3*interval '1 second'),last_error='Delivery failed' WHERE id=$1",
        [
          mail.id,
          mail.attempts >= 6 ? "failed" : "pending",
          Math.min(3600, 30 * 2 ** mail.attempts),
        ],
      );
    }
  } catch {
    console.error("Worker: database unavailable; retrying.");
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await pool.end();
