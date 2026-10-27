import { z } from "zod";
import type { ExplorerFeatures } from "@/features/places/features";

// Shared by the admin form, the API and the embed page. Keep it free of
// server-only imports.

export const integrationSettingsSchema = z
  .object({
    content: z
      .object({
        kinds: z
          .array(z.enum(["location", "experience"]))
          .min(1, "Alege cel puțin un tip: locații sau experiențe.")
          .max(2),
        categoryMode: z.enum(["all", "selected"]),
        categoryIds: z.array(z.string().max(64)).max(200),
        regionMode: z.enum(["all", "selected"]),
        regions: z.array(z.string().trim().min(1).max(80)).max(30),
        excludedListingIds: z.array(z.string().max(100)).max(500),
      })
      .strict(),
    contacts: z
      .object({
        locations: z.boolean(),
        experiences: z.boolean(),
        booking: z.boolean(),
        messengers: z.boolean(),
        social: z.boolean(),
      })
      .strict(),
    features: z
      .object({
        header: z.boolean(),
        search: z.boolean(),
        categoryFilter: z.boolean(),
        advancedFilters: z.boolean(),
        favorites: z.boolean(),
        route: z.boolean(),
        prices: z.boolean(),
        languageSwitch: z.boolean(),
        contribute: z.boolean(),
        about: z.boolean(),
        branding: z.boolean(),
      })
      .strict(),
    display: z
      .object({
        locale: z.enum(["ro", "en", "ru"]),
        mobileView: z.enum(["map", "list"]),
        height: z.number().int().min(320).max(1600),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.content.categoryMode === "selected" &&
      !value.content.categoryIds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Selectează cel puțin o categorie sau alege „Toate”.",
      });
    if (
      value.content.regionMode === "selected" &&
      !value.content.regions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Selectează cel puțin o regiune sau alege „Toate”.",
      });
  });
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;

export const defaultIntegrationSettings: IntegrationSettings = {
  content: {
    kinds: ["location", "experience"],
    categoryMode: "all",
    categoryIds: [],
    regionMode: "all",
    regions: [],
    excludedListingIds: [],
  },
  contacts: {
    locations: true,
    experiences: true,
    booking: true,
    messengers: true,
    social: true,
  },
  features: {
    header: true,
    search: true,
    categoryFilter: true,
    advancedFilters: true,
    favorites: true,
    route: true,
    prices: true,
    languageSwitch: true,
    contribute: false,
    about: false,
    branding: true,
  },
  display: { locale: "ro", mobileView: "map", height: 640 },
};

export function explorerFeatures(
  settings: IntegrationSettings,
): ExplorerFeatures {
  return { ...settings.features, account: false };
}

const hostname =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Turns whatever the admin pasted ("https://www.Site.md/contact", "site.md")
 * into a bare host, optionally with a port. Returns null when invalid.
 */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw || raw.includes("*") || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/\.$/, "");
  if (!hostname.test(host)) return null;
  return url.port ? `${host}:${url.port}` : host;
}

export const domainsSchema = z
  .array(z.string().max(300))
  .min(1, "Adaugă cel puțin un domeniu autorizat.")
  .max(20, "Maximum 20 de domenii per integrare.")
  .transform((list, ctx) => {
    const result: string[] = [];
    for (const item of list) {
      const domain = normalizeDomain(item);
      if (!domain) {
        ctx.addIssue({
          code: "custom",
          message: `Domeniu invalid: „${item}”. Exemplu corect: exemplu.md`,
        });
        return z.NEVER;
      }
      if (!result.includes(domain)) result.push(domain);
    }
    return result;
  });

/** Every host a configured domain covers (adds the www./bare twin). */
export function expandDomains(domains: string[], subdomains: boolean) {
  const hosts = new Set<string>();
  for (const domain of domains) {
    hosts.add(domain);
    const [host, port] = domain.split(":");
    const isIp = /^[\d.]+$/.test(host) || host === "localhost";
    if (!isIp) {
      const twin = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      if (twin.includes(".")) hosts.add(port ? `${twin}:${port}` : twin);
      if (subdomains) hosts.add(port ? `*.${host}:${port}` : `*.${host}`);
    }
  }
  return [...hosts];
}

/** CSP frame-ancestors value: the browser refuses any other parent page. */
export function frameAncestors(domains: string[], subdomains: boolean) {
  // Scheme-less sources match the embed's scheme and its https upgrade.
  return ["'self'", ...expandDomains(domains, subdomains)].join(" ");
}

/** Server-side check of the Referer origin against the allowed domains. */
export function originAllowed(
  origin: string,
  domains: string[],
  subdomains: boolean,
) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return expandDomains(domains, subdomains).some((pattern) => {
    const withPort = pattern.includes(":");
    const target = withPort ? url.host : url.hostname;
    if (pattern.startsWith("*.")) return target.endsWith(pattern.slice(1));
    return target === pattern;
  });
}

export function embedCode(
  baseUrl: string,
  publicKey: string,
  height: number,
  title = "Harta Hai Moldova",
) {
  const src = `${baseUrl.replace(/\/$/, "")}/embed/${publicKey}`;
  return `<iframe src="${src}" title="${title}" width="100%" height="${height}" style="border:0;border-radius:12px;max-width:100%;display:block" loading="lazy" allow="geolocation; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}
