"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Leaf } from "lucide-react";

/**
 * Re-renders the embed when the integration or the published catalog changes,
 * keeping the visitor's selection and filters (router.refresh, not reload).
 */
export function EmbedLiveUpdates({
  embedKey,
  version,
}: {
  embedKey: string;
  version: string;
}) {
  const router = useRouter();
  const current = useRef(version);
  useEffect(() => {
    current.current = version;
  }, [version]);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/embed/${embedKey}`, {
          cache: "no-store",
        });
        const { version: latest } = await response.json();
        if (!stopped && latest && latest !== current.current) {
          current.current = latest;
          router.refresh();
        }
      } catch {}
    };
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [embedKey, router]);
  return null;
}

export function EmbedMessage({
  title,
  text,
  siteUrl,
}: {
  title: string;
  text: string;
  siteUrl: string;
}) {
  return (
    <main className="embed-message">
      <div>
        <span>
          <Leaf size={26} />
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
        <a href={siteUrl} target="_blank" rel="noopener">
          Deschide Hai Moldova
        </a>
      </div>
    </main>
  );
}
