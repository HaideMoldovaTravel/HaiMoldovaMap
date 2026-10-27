// Telegram Bot API client shared by the web app and scripts/worker.ts.
// The bot token stays in the environment; it is never stored in the database.

export const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";

export class TelegramError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

export async function telegramRequest<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = telegramToken();
  if (!token)
    throw new TelegramError("Botul Telegram nu este configurat.", false);
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new TelegramError("Telegram nu răspunde. Reîncercăm.", true);
  }
  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
    parameters?: { retry_after?: number };
  };
  if (!result.ok) {
    // Never echo the URL: it contains the bot token.
    const description = (result.description ?? `HTTP ${response.status}`).slice(
      0,
      200,
    );
    throw new TelegramError(
      translateTelegramError(description),
      response.status === 429 || response.status >= 500,
      result.parameters?.retry_after ?? 0,
    );
  }
  return result.result as T;
}

function translateTelegramError(description: string) {
  if (/chat not found/i.test(description))
    return "Grupul nu a fost găsit. Verifică ID-ul și dacă botul este membru.";
  if (/bot was kicked|not a member/i.test(description))
    return "Botul nu mai este membru al grupului.";
  if (/not enough rights|have no rights/i.test(description))
    return "Botul nu are drept să scrie în grup.";
  if (/unauthorized/i.test(description)) return "Tokenul botului este invalid.";
  if (/thread not found/i.test(description))
    return "Subiectul (topic) nu a fost găsit în grup.";
  return `Telegram: ${description}`;
}

/** Telegram rejects inline buttons pointing to localhost or private hosts. */
export function publicButtonUrl(url: string) {
  try {
    const { hostname, protocol } = new URL(url);
    if (!["http:", "https:"].includes(protocol)) return null;
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(hostname) ||
      !hostname.includes(".")
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
