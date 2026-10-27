import "server-only";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { appSettings, audit, notificationOutbox } from "./db/schema";
import { HttpError, requireAdmin, type Actor } from "./access";
import { escapeHtml } from "./mail";
import {
  publicButtonUrl,
  telegramRequest,
  telegramToken,
} from "@/modules/notifications/telegram";

export const telegramSettingsSchema = z
  .object({
    enabled: z.boolean(),
    chatId: z
      .string()
      .trim()
      .max(64)
      .regex(/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})?$/, "ID de chat invalid."),
    threadId: z
      .string()
      .trim()
      .max(20)
      .regex(/^\d*$/, "ID-ul subiectului trebuie să fie numeric."),
    events: z
      .object({
        locationSubmitted: z.boolean(),
        experienceSubmitted: z.boolean(),
        updates: z.boolean(),
        decisions: z.boolean(),
        reminders: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type TelegramSettings = z.infer<typeof telegramSettingsSchema>;

const defaults: TelegramSettings = {
  enabled: false,
  chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  threadId: process.env.TELEGRAM_THREAD_ID ?? "",
  events: {
    locationSubmitted: true,
    experienceSubmitted: true,
    updates: true,
    decisions: true,
    reminders: true,
  },
};

type Executor = Pick<typeof db, "select" | "insert">;

export async function telegramSettings(
  executor: Executor = db,
): Promise<TelegramSettings> {
  const [row] = await executor
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "telegram"));
  const parsed = telegramSettingsSchema.safeParse({
    ...defaults,
    ...(row?.value as object | undefined),
    events: {
      ...defaults.events,
      ...((row?.value as { events?: object } | undefined)?.events ?? {}),
    },
  });
  return parsed.success ? parsed.data : defaults;
}

export async function telegramOverview(actor: Actor) {
  requireAdmin(actor, true);
  const [settings, recent] = await Promise.all([
    telegramSettings(),
    db
      .select({
        id: notificationOutbox.id,
        kind: notificationOutbox.kind,
        status: notificationOutbox.status,
        attempts: notificationOutbox.attempts,
        error: notificationOutbox.error,
        createdAt: notificationOutbox.createdAt,
        sentAt: notificationOutbox.sentAt,
        payload: notificationOutbox.payload,
      })
      .from(notificationOutbox)
      .orderBy(desc(notificationOutbox.createdAt))
      .limit(30),
  ]);
  let bot: { username: string; name: string } | null = null;
  let botError = "";
  if (telegramToken()) {
    try {
      const me = await telegramRequest<{
        username: string;
        first_name: string;
      }>("getMe", {});
      bot = { username: me.username, name: me.first_name };
    } catch (error) {
      botError = (error as Error).message;
    }
  }
  return {
    settings,
    tokenConfigured: !!telegramToken(),
    bot,
    botError,
    recent: recent.map((r) => ({
      ...r,
      preview: r.payload.text.replace(/<[^>]+>/g, "").slice(0, 160),
      payload: undefined,
    })),
  };
}

export async function saveTelegramSettings(actor: Actor, raw: unknown) {
  requireAdmin(actor, true);
  const settings = telegramSettingsSchema.parse(raw);
  if (settings.enabled && !settings.chatId)
    throw new HttpError(400, "Completează ID-ul grupului înainte de activare.");
  if (settings.enabled && !telegramToken())
    throw new HttpError(
      400,
      "Lipsește TELEGRAM_BOT_TOKEN în configurarea serverului.",
    );
  await db
    .insert(appSettings)
    .values({ key: "telegram", value: settings, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: settings, updatedBy: actor.id, updatedAt: new Date() },
    });
  await db.insert(audit).values({
    id: randomUUID(),
    actorId: actor.id,
    action: "telegram.configured",
    resourceId: "telegram",
  });
  return { ok: true };
}

/** Lists groups the bot has seen recently, so nobody has to hunt for IDs. */
export async function detectTelegramChats(actor: Actor) {
  requireAdmin(actor, true);
  if (!telegramToken())
    throw new HttpError(400, "Lipsește TELEGRAM_BOT_TOKEN.");
  type Chat = { id: number; title?: string; type: string; is_forum?: boolean };
  const updates = await telegramRequest<
    {
      message?: { chat: Chat; message_thread_id?: number };
      my_chat_member?: { chat: Chat };
    }[]
  >("getUpdates", {
    allowed_updates: ["message", "my_chat_member"],
    limit: 100,
  });
  const chats = new Map<
    string,
    { id: string; title: string; type: string; threads: string[] }
  >();
  for (const update of updates) {
    const chat = update.message?.chat ?? update.my_chat_member?.chat;
    if (!chat || chat.type === "private") continue;
    const entry = chats.get(String(chat.id)) ?? {
      id: String(chat.id),
      title: chat.title ?? String(chat.id),
      type: chat.is_forum ? "forum" : chat.type,
      threads: [],
    };
    const thread = update.message?.message_thread_id;
    if (thread && !entry.threads.includes(String(thread)))
      entry.threads.push(String(thread));
    chats.set(entry.id, entry);
  }
  return { chats: [...chats.values()] };
}

export async function sendTelegramTest(actor: Actor, raw: unknown) {
  requireAdmin(actor, true);
  const input = telegramSettingsSchema
    .pick({ chatId: true, threadId: true })
    .parse(raw);
  if (!input.chatId) throw new HttpError(400, "Completează ID-ul grupului.");
  const url = publicButtonUrl(`${siteUrl()}/admin/moderation`);
  await telegramRequest("sendMessage", {
    chat_id: input.chatId,
    ...(input.threadId ? { message_thread_id: Number(input.threadId) } : {}),
    parse_mode: "HTML",
    text: `✅ <b>Hai Moldova</b>\nNotificările de moderare sunt conectate la acest grup.\nTest trimis de ${escapeHtml(actor.name)}.`,
    ...(url
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: "Deschide moderarea", url }]],
          },
        }
      : {}),
  });
  return { ok: true };
}

const siteUrl = () =>
  (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

const kindLabels = {
  location: { new: "Locație nouă", update: "Modificare la o locație" },
  experience: { new: "Experiență nouă", update: "Modificare la o experiență" },
};

/**
 * Queues the moderation alert inside the caller's transaction, so a
 * submission and its notification are committed (or rolled back) together.
 */
export async function queueSubmissionNotice(
  tx: Executor,
  input: {
    revisionId: string;
    kind: string;
    isUpdate: boolean;
    name: string;
    categoryName: string;
    place: string;
    authorName: string;
  },
) {
  const settings = await telegramSettings(tx);
  const experience = input.kind === "experience";
  if (
    !settings.enabled ||
    !settings.chatId ||
    !telegramToken() ||
    (input.isUpdate && !settings.events.updates) ||
    (!input.isUpdate &&
      !(experience
        ? settings.events.experienceSubmitted
        : settings.events.locationSubmitted))
  )
    return;
  const link = `${siteUrl()}/admin/moderation/${input.revisionId}`;
  const label = kindLabels[experience ? "experience" : "location"];
  const lines = [
    `${input.isUpdate ? "✏️" : "🆕"} <b>${input.isUpdate ? label.update : label.new} la moderare</b>`,
    "",
    `<b>${escapeHtml(input.name || "Fără denumire")}</b>`,
    `Categoria: ${escapeHtml(input.categoryName)}`,
    ...(input.place ? [`Localitatea: ${escapeHtml(input.place)}`] : []),
    `Trimis de: ${escapeHtml(input.authorName)}`,
    "",
    `🔗 ${escapeHtml(link)}`,
  ];
  await tx.insert(notificationOutbox).values({
    id: randomUUID(),
    refId: input.revisionId,
    payload: {
      text: lines.join("\n"),
      buttonUrl: link,
      buttonText: "Deschide în administrare",
    },
  });
}

/** Marks the original alert as handled, so the group sees what is left. */
export async function queueDecisionNotice(
  tx: Executor,
  input: { revisionId: string; decision: string; moderatorName: string },
) {
  const settings = await telegramSettings(tx);
  if (!settings.enabled || !settings.events.decisions || !telegramToken())
    return;
  const [original] = await tx
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(eq(notificationOutbox.refId, input.revisionId))
    .limit(1);
  if (!original) return;
  const verdict =
    {
      approve: "✅ Aprobată",
      changes: "↩️ Trimisă la corectări",
      reject: "⛔ Respinsă",
      superseded: "🔁 Înlocuită cu o revizie nouă",
    }[input.decision] ?? input.decision;
  await tx.insert(notificationOutbox).values({
    id: randomUUID(),
    kind: "edit",
    refId: input.revisionId,
    payload: {
      text: `${verdict} de ${escapeHtml(input.moderatorName)} · ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Chisinau", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    },
  });
}
