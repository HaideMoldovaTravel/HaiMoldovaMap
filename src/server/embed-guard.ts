// Used by src/proxy.ts, so no "server-only" import here.
import { eq } from "drizzle-orm";
import { db } from "./db";
import { partnerIntegrations } from "./db/schema";
import { frameAncestors } from "@/modules/integrations/settings";

/**
 * CSP frame-ancestors for an embed URL. Browsers refuse to render the iframe
 * on any page outside these origins, whatever the HTML snippet says.
 */
export async function embedFrameAncestors(key: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return "'self'";
  const [row] = await db
    .select({
      domains: partnerIntegrations.domains,
      allowSubdomains: partnerIntegrations.allowSubdomains,
    })
    .from(partnerIntegrations)
    .where(eq(partnerIntegrations.publicKey, key));
  // Paused integrations stay frameable so the partner sees a clear message.
  return row ? frameAncestors(row.domains, row.allowSubdomains) : "'self'";
}
