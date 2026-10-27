import { randomUUID } from "node:crypto";
import { pool } from "../src/server/db";
import {
  publicButtonUrl,
  telegramRequest,
  TelegramError,
} from "../src/modules/notifications/telegram";

type Settings = {
  enabled?: boolean;
  chatId?: string;
  threadId?: string;
  events?: { reminders?: boolean };
};
type Payload = { text: string; buttonUrl?: string; buttonText?: string };

async function settings(): Promise<Settings> {
  const { rows } = await pool.query(
    "SELECT value FROM app_settings WHERE key='telegram'",
  );
  return (rows[0]?.value as Settings) ?? {};
}

const keyboard = (payload: Payload) => {
  const url = payload.buttonUrl && publicButtonUrl(payload.buttonUrl);
  return url
    ? {
        reply_markup: {
          inline_keyboard: [[{ text: payload.buttonText ?? "Deschide", url }]],
        },
      }
    : {};
};

async function finish(id: string, status: string, error: string | null) {
  await pool.query(
    "UPDATE notification_outbox SET status=$2,last_error=$3,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END WHERE id=$1",
    [id, status, error],
  );
}

/** Sends or edits one queued Telegram message. Returns false when idle. */
export async function processNotification() {
  const { rows } = await pool.query(
    `UPDATE notification_outbox SET status='processing', locked_at=now(), attempts=attempts+1 WHERE id=(SELECT id FROM notification_outbox WHERE (status='pending' AND available_at<=now()) OR (status='processing' AND locked_at < now()-interval '5 minutes') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
  );
  const job = rows[0];
  if (!job) return false;
  const payload = job.payload as Payload;
  try {
    const config = await settings();
    if (!config.enabled || !config.chatId) {
      await finish(
        job.id,
        "skipped",
        "Notificările Telegram sunt dezactivate.",
      );
      return true;
    }
    if (job.kind === "edit") {
      const { rows: originals } = await pool.query(
        "SELECT status, external_id, payload FROM notification_outbox WHERE ref_id=$1 AND kind='send' ORDER BY created_at LIMIT 1",
        [job.ref_id],
      );
      const original = originals[0];
      if (!original || ["failed", "skipped"].includes(original.status)) {
        await finish(job.id, "skipped", "Mesajul inițial nu a fost trimis.");
        return true;
      }
      if (original.status !== "sent") {
        // Wait for the original alert; do not burn retry attempts meanwhile.
        await pool.query(
          "UPDATE notification_outbox SET status='pending',attempts=attempts-1,available_at=now()+interval '15 seconds' WHERE id=$1",
          [job.id],
        );
        return true;
      }
      const [chatId, messageId] = String(original.external_id).split("|");
      const base = original.payload as Payload;
      try {
        await telegramRequest("editMessageText", {
          chat_id: chatId,
          message_id: Number(messageId),
          parse_mode: "HTML",
          text: `${base.text}\n\n${payload.text}`,
          link_preview_options: { is_disabled: true },
          ...keyboard(base),
        });
      } catch (error) {
        if (!/not modified/i.test((error as Error).message)) throw error;
      }
      await finish(job.id, "sent", null);
      return true;
    }
    const message = await telegramRequest<{ message_id: number }>(
      "sendMessage",
      {
        chat_id: config.chatId,
        ...(config.threadId
          ? { message_thread_id: Number(config.threadId) }
          : {}),
        parse_mode: "HTML",
        text: payload.text,
        link_preview_options: { is_disabled: true },
        ...keyboard(payload),
      },
    );
    await pool.query(
      "UPDATE notification_outbox SET status='sent',sent_at=now(),external_id=$2,last_error=NULL WHERE id=$1",
      [job.id, `${config.chatId}|${message.message_id}`],
    );
  } catch (error) {
    const retryable = !(error instanceof TelegramError) || error.retryable;
    const finalAttempt = job.attempts >= 6 || !retryable;
    const delay =
      error instanceof TelegramError && error.retryAfter
        ? error.retryAfter
        : Math.min(3600, 30 * 2 ** job.attempts);
    await pool.query(
      "UPDATE notification_outbox SET status=$2,available_at=now()+($3*interval '1 second'),last_error=$4 WHERE id=$1",
      [
        job.id,
        finalAttempt ? "failed" : "pending",
        delay,
        (error instanceof Error ? error.message : "Eroare necunoscută").slice(
          0,
          300,
        ),
      ],
    );
  }
  return true;
}

/**
 * Once a day (after 09:00 Chisinau time) reminds the group about proposals
 * that have waited more than 24 hours. Safe with several workers running.
 */
export async function queueModerationReminder() {
  const config = await settings();
  if (!config.enabled || !config.chatId || config.events?.reminders === false)
    return;
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => local.find((p) => p.type === type)?.value;
  if (Number(part("hour")) < 9) return;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO app_settings(key,value) VALUES('telegram_reminder', jsonb_build_object('date',$1::text))
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()
       WHERE app_settings.value->>'date' IS DISTINCT FROM $1::text RETURNING key`,
      [today],
    );
    if (claimed.rowCount) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS count FROM listing_revisions r WHERE r.status='pending' AND (SELECT max(a.created_at) FROM audit_log a WHERE a.action='revision.submitted' AND a.resource_id=r.id) < now()-interval '24 hours'`,
      );
      const count = Number(rows[0].count);
      if (count > 0) {
        const base = (
          process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
        ).replace(/\/$/, "");
        await client.query(
          "INSERT INTO notification_outbox(id,payload) VALUES($1,$2)",
          [
            randomUUID(),
            {
              text: `⏰ <b>${count === 1 ? "O propunere așteaptă" : `${count} propuneri așteaptă`} moderarea de peste 24 de ore.</b>\n\n🔗 ${base}/admin/moderation`,
              buttonUrl: `${base}/admin/moderation`,
              buttonText: "Deschide moderarea",
            },
          ],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
