"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Radar,
  Save,
  Send,
  TriangleAlert,
  BellRing,
} from "lucide-react";
import { api } from "@/components/platform/api";
import { Badge, Notice, PageTitle, dateTime } from "./shared";

type Settings = {
  enabled: boolean;
  chatId: string;
  threadId: string;
  events: {
    locationSubmitted: boolean;
    experienceSubmitted: boolean;
    updates: boolean;
    decisions: boolean;
    reminders: boolean;
  };
};
export type TelegramOverview = {
  settings: Settings;
  tokenConfigured: boolean;
  bot: { username: string; name: string } | null;
  botError: string;
  recent: {
    id: string;
    kind: string;
    status: string;
    attempts: number;
    error: string | null;
    createdAt: string;
    sentAt: string | null;
    preview: string;
  }[];
};
type Chat = { id: string; title: string; type: string; threads: string[] };

const events: { id: keyof Settings["events"]; label: string; help: string }[] =
  [
    {
      id: "experienceSubmitted",
      label: "Experiență nouă trimisă la moderare",
      help: "Mesaj cu denumirea, categoria, autorul și linkul direct.",
    },
    {
      id: "locationSubmitted",
      label: "Locație nouă trimisă la moderare",
      help: "La fel, pentru locații.",
    },
    {
      id: "updates",
      label: "Modificări la fișe deja publicate",
      help: "Când un prestator trimite o versiune nouă a unei fișe publicate.",
    },
    {
      id: "decisions",
      label: "Marchează decizia în mesajul inițial",
      help: "După aprobare sau respingere, mesajul din grup arată cine a decis — echipa vede ce a rămas.",
    },
    {
      id: "reminders",
      label: "Memento zilnic",
      help: "La 09:00, dacă există propuneri care așteaptă de peste 24 de ore.",
    },
  ];

const statusText: Record<string, string> = {
  pending: "În așteptare",
  processing: "Se trimite",
  sent: "Trimis",
  failed: "Eșuat",
  skipped: "Omis",
};

export function TelegramPage({ overview }: { overview: TelegramOverview }) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(overview.settings);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "test" | "detect">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const run = async (
    kind: "save" | "test" | "detect",
    task: () => Promise<void>,
  ) => {
    setBusy(kind);
    setMessage("");
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const ready = overview.tokenConfigured && !!overview.bot;
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRARE"
        title="Notificări Telegram"
        description="Botul anunță în grupul echipei fiecare propunere nouă la moderare, cu link direct spre decizie."
      />
      <Notice message={message} />
      <Notice message={error} error />
      <div className="ad-edit-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("save", async () => {
              await api("telegram", form);
              setMessage("Setările au fost salvate.");
              router.refresh();
            });
          }}
        >
          <section className="ad-card ad-form-card">
            <div className="ad-card-heading">
              <div>
                <h2>Grupul echipei</h2>
                <p>
                  Unde scrie botul. Poate fi un grup sau un subiect (topic).
                </p>
              </div>
              <BellRing size={21} />
            </div>
            <div className="ad-toggle-row">
              <div>
                <strong>Notificări active</strong>
                <small>Oprește temporar fără să pierzi configurarea.</small>
              </div>
              <input
                type="checkbox"
                role="switch"
                aria-label="Notificări active"
                checked={form.enabled}
                disabled={!ready && !form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
            </div>
            <div className="ad-form-grid">
              <label>
                ID grup
                <input
                  placeholder="-1001234567890"
                  value={form.chatId}
                  onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                />
                <small>Grupurile au ID negativ. Folosește „Detectează”.</small>
              </label>
              <label>
                ID subiect (opțional)
                <input
                  inputMode="numeric"
                  placeholder="Doar pentru grupuri cu subiecte"
                  value={form.threadId}
                  onChange={(e) =>
                    setForm({ ...form, threadId: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="ad-code-actions">
              <button
                type="button"
                className="ad-button"
                disabled={!ready || !!busy}
                onClick={() =>
                  run("detect", async () => {
                    const result = await api<{ chats: Chat[] }>(
                      "telegram-detect",
                      {},
                    );
                    setChats(result.chats);
                  })
                }
              >
                <Radar size={15} />
                {busy === "detect" ? "Se caută…" : "Detectează grupul"}
              </button>
              <button
                type="button"
                className="ad-button"
                disabled={!ready || !form.chatId || !!busy}
                onClick={() =>
                  run("test", async () => {
                    await api("telegram-test", {
                      chatId: form.chatId,
                      threadId: form.threadId,
                    });
                    setMessage(
                      "Mesajul de test a fost trimis. Verifică grupul.",
                    );
                  })
                }
              >
                <Send size={15} />
                {busy === "test" ? "Se trimite…" : "Trimite mesaj de test"}
              </button>
            </div>
            {chats && (
              <div className="ad-chat-list">
                {chats.length ? (
                  chats.map((chat) => (
                    <div key={chat.id}>
                      <span>
                        <strong>{chat.title}</strong>
                        <small>
                          {chat.type === "forum"
                            ? "grup cu subiecte"
                            : chat.type}{" "}
                          · {chat.id}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="ad-button ad-button-small"
                        onClick={() =>
                          setForm({
                            ...form,
                            chatId: chat.id,
                            threadId: chat.threads[0] ?? "",
                          })
                        }
                      >
                        Folosește
                      </button>
                    </div>
                  ))
                ) : (
                  <p>
                    Niciun grup găsit. Adaugă botul în grup, scrie în grup{" "}
                    <code>/start@{overview.bot?.username}</code> și încearcă din
                    nou.
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="ad-card ad-form-card">
            <div className="ad-card-heading">
              <div>
                <h2>Când trimite botul</h2>
                <p>Mesajele conțin doar denumirea, categoria și autorul.</p>
              </div>
            </div>
            {events.map((event) => (
              <div className="ad-toggle-row" key={event.id}>
                <div>
                  <strong>{event.label}</strong>
                  <small>{event.help}</small>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={event.label}
                  checked={form.events[event.id]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      events: { ...form.events, [event.id]: e.target.checked },
                    })
                  }
                />
              </div>
            ))}
          </section>
          <div className="ad-sticky-actions">
            <button className="ad-button ad-button-primary" disabled={!!busy}>
              <Save size={16} />
              {busy === "save" ? "Se salvează…" : "Salvează setările"}
            </button>
          </div>
        </form>
        <aside>
          <section className="ad-card ad-form-card">
            <h2>Botul</h2>
            <div className="ad-service-row">
              <Bot size={20} />
              <div>
                <strong>
                  {overview.bot ? `@${overview.bot.username}` : "Neconectat"}
                </strong>
                <small>
                  {overview.tokenConfigured
                    ? (overview.bot?.name ?? overview.botError)
                    : "Lipsește TELEGRAM_BOT_TOKEN"}
                </small>
              </div>
              <Badge value={ready ? "active" : "rejected"}>
                {ready ? "Conectat" : "Neconfigurat"}
              </Badge>
            </div>
            <h3 className="ad-subheading">Configurare în 4 pași</h3>
            <ol className="ad-steps">
              <li>
                În Telegram, deschide <strong>@BotFather</strong>, trimite{" "}
                <code>/newbot</code> și copiază tokenul.
              </li>
              <li>
                Pune tokenul în <code>.env</code> ca{" "}
                <code>TELEGRAM_BOT_TOKEN</code> și repornește aplicația și
                worker-ul.
              </li>
              <li>
                Creează grupul echipei și adaugă botul ca membru. Scrie în grup{" "}
                <code>/start</code>.
              </li>
              <li>
                Apasă „Detectează grupul”, apoi „Trimite mesaj de test” și
                activează notificările.
              </li>
            </ol>
            <p className="ad-muted">
              Linkurile duc la pagina de moderare; cine nu e autentificat e
              trimis la login și revine apoi la propunere. Mesajele sunt trimise
              de procesul worker, cu reîncercări automate.
            </p>
          </section>
          <section className="ad-card ad-form-card">
            <h2>Ultimele mesaje</h2>
            {overview.recent.length ? (
              <ul className="ad-notification-log">
                {overview.recent.map((item) => (
                  <li key={item.id}>
                    {item.status === "sent" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <TriangleAlert size={16} />
                    )}
                    <div>
                      <strong>
                        {item.kind === "edit" ? "Actualizare: " : ""}
                        {item.preview}
                      </strong>
                      <small>
                        {statusText[item.status] ?? item.status} ·{" "}
                        {dateTime(item.sentAt ?? item.createdAt)}
                        {item.error && item.status !== "sent"
                          ? ` · ${item.error}`
                          : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Încă nu a fost trimis niciun mesaj.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
