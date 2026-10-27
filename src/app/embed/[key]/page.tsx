import type { Metadata } from "next";
import { headers } from "next/headers";
import { Explorer } from "@/components/explore/explorer";
import { EmbedLiveUpdates, EmbedMessage } from "@/components/embed/embed";
import { I18nProvider } from "@/features/i18n/provider";
import { currentActor, isAdmin } from "@/server/access";
import {
  embedCatalog,
  embedVersion,
  integrationByKey,
  recordEmbedView,
} from "@/server/integrations";
import {
  explorerFeatures,
  originAllowed,
} from "@/modules/integrations/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Harta Hai Moldova",
  robots: { index: false, follow: false },
};

const siteUrl = () =>
  (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const integration = await integrationByKey(key);
  if (!integration)
    return (
      <EmbedMessage
        title="Hartă indisponibilă"
        text="Acest cod de integrare nu există sau a fost înlocuit. Contactează echipa Hai Moldova."
        siteUrl={siteUrl()}
      />
    );
  // The CSP set in src/proxy.ts is the hard guarantee; this second check
  // explains the refusal and records attempts from unknown sites.
  const request = await headers();
  const destination = request.get("sec-fetch-dest");
  const own = new URL(siteUrl()).origin;
  let origin = "";
  try {
    origin = new URL(request.get("referer") ?? "").origin;
  } catch {}
  const external = !!origin && origin !== own;
  const allowed =
    !external ||
    originAllowed(origin, integration.domains, integration.allowSubdomains);
  if (destination === "iframe" && external)
    await recordEmbedView(integration.id, new URL(origin).host, allowed).catch(
      () => {},
    );
  if (!allowed)
    return (
      <EmbedMessage
        title="Domeniu neautorizat"
        text="Această hartă poate fi afișată numai pe site-urile partenerilor autorizați de Hai Moldova."
        siteUrl={siteUrl()}
      />
    );
  if (destination === "document") {
    const actor = await currentActor().catch(() => null);
    if (!actor || !isAdmin(actor))
      return (
        <EmbedMessage
          title="Hartă pentru parteneri"
          text="Această hartă este destinată afișării pe site-ul unui partener. Explorează versiunea completă pe Hai Moldova."
          siteUrl={siteUrl()}
        />
      );
  }
  if (integration.status !== "active")
    return (
      <EmbedMessage
        title="Hartă indisponibilă temporar"
        text="Harta va reveni în curând. Între timp, poți explora locurile pe Hai Moldova."
        siteUrl={siteUrl()}
      />
    );
  const settings = integration.settings;
  const [{ places, categories }, version] = await Promise.all([
    embedCatalog(settings),
    embedVersion(integration),
  ]);
  return (
    <I18nProvider
      initialLocale={settings.display.locale}
      persist={settings.features.languageSwitch}
    >
      <Explorer
        initialPlaces={places}
        initialCategories={[
          { id: "all", label: "Toate locurile", labelEn: "All places" },
          ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            labelEn: c.nameEn,
            icon: c.iconAssetId ? `/api/media/${c.iconAssetId}` : undefined,
          })),
        ]}
        features={explorerFeatures(settings)}
        embedded
        initialMobileView={settings.display.mobileView}
        siteUrl={siteUrl()}
      />
      <EmbedLiveUpdates embedKey={key} version={version} />
    </I18nProvider>
  );
}
