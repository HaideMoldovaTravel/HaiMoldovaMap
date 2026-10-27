"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./api";
export function AcceptInvite({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="platform-auth">
      <Link href="/" className="platform-brand">
        haimoldova
      </Link>
      <h1>Invitație în echipă</h1>
      <p>
        Acceptă invitația folosind contul cu adresa de email la care ai primit
        mesajul.
      </p>
      {signedIn ? (
        <button
          className="platform-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`accept-invite/${token}`, {});
              router.push("/admin");
              router.refresh();
            } catch (error) {
              setMessage((error as Error).message);
              setBusy(false);
            }
          }}
        >
          Acceptă invitația
        </button>
      ) : (
        <Link
          className="platform-primary"
          href={`/autentificare?returnTo=${encodeURIComponent(`/invitatie/${token}`)}`}
        >
          Autentificare / Înregistrare
        </Link>
      )}
      {message && (
        <p className="platform-notice" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
