"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
const authClient = createAuthClient();
export function AuthForm({
  token,
  returnTo = "/cont",
}: {
  token?: string;
  returnTo?: string;
}) {
  const [mode, setMode] = useState<
    "login" | "register" | "forgot" | "reset" | "verify"
  >(token ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const destination =
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\")
      ? returnTo
      : "/cont";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: destination,
        });
        if (result.error)
          throw new Error(result.error.message ?? "Înregistrarea a eșuat.");
        setMessage(
          "Verifică emailul și confirmă adresa. Dacă ai deja cont, autentifică-te.",
        );
        setMode("verify");
      } else if (mode === "login") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          if (result.error.status === 403) setMode("verify");
          throw new Error(result.error.message ?? "Autentificarea a eșuat.");
        }
        window.location.assign(destination);
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/autentificare",
        });
        if (result.error) throw new Error(result.error.message);
        setMessage(
          "Dacă există un cont cu acest email, vei primi un link pentru resetarea parolei.",
        );
      } else if (mode === "reset") {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: token!,
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("Parola a fost schimbată. Te poți autentifica.");
        setPassword("");
        setMode("login");
      } else {
        const result = await authClient.sendVerificationEmail({
          email,
          callbackURL: destination,
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("Dacă adresa necesită verificare, vei primi un link nou.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }
  const switchTo = (next: typeof mode) => {
    setMode(next);
    setMessage("");
  };
  return (
    <div className="platform-auth">
      <div className="auth-top">
        <Link href="/" className="auth-back">
          <ArrowLeft size={18} />
          <span>Înapoi la hartă</span>
        </Link>
      </div>
      <Link href="/" className="platform-brand">
        hai<span>moldova</span>
      </Link>
      <p className="platform-eyebrow">LOCURI MICI. POVEȘTI MARI.</p>
      <h1>
        {
          {
            login: "Bine ai revenit",
            register: "Creează un cont",
            forgot: "Ai uitat parola?",
            reset: "Alege o parolă nouă",
            verify: "Confirmă emailul",
          }[mode]
        }
      </h1>
      <p className="auth-lead">
        {
          {
            login: "Intră în cont ca să adaugi și să gestionezi locurile tale.",
            register:
              "Adaugă pe hartă locații și experiențe din toată Moldova.",
            forgot: "Îți trimitem pe email un link pentru o parolă nouă.",
            reset: "Alege o parolă de cel puțin 12 caractere.",
            verify:
              "Ți-am trimis un link de confirmare. Verifică și folderul Spam.",
          }[mode]
        }
      </p>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label>
            Nume
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={100}
              placeholder="Numele tău"
            />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Email
            <input
              required
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="nume@exemplu.md"
            />
          </label>
        )}
        {["register", "login", "reset"].includes(mode) && (
          <label>
            <span className="auth-label-row">
              Parolă
              {mode === "login" && (
                <button type="button" onClick={() => switchTo("forgot")}>
                  Ai uitat parola?
                </button>
              )}
            </span>
            <span className="auth-password">
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={mode === "login" ? 1 : 12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
            {mode !== "login" && <small>Cel puțin 12 caractere.</small>}
          </label>
        )}
        {message && (
          <div className="platform-notice" role="status">
            {message}
          </div>
        )}
        <button className="platform-primary" disabled={busy}>
          {busy
            ? "Se procesează…"
            : {
                login: "Autentifică-te",
                register: "Creează contul",
                forgot: "Trimite linkul",
                reset: "Salvează parola",
                verify: "Retrimite confirmarea",
              }[mode]}
        </button>
      </form>
      <div className="auth-switch">
        {mode === "login" ? (
          <>
            <span>Nu ai cont?</span>
            <button
              className="platform-secondary"
              onClick={() => switchTo("register")}
            >
              Creează un cont
            </button>
          </>
        ) : (
          <>
            <span>{mode === "register" ? "Ai deja cont?" : ""}</span>
            <button
              className="platform-secondary"
              onClick={() => switchTo("login")}
            >
              {mode === "register"
                ? "Autentifică-te"
                : "Înapoi la autentificare"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
