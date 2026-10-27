import { NextResponse } from "next/server";
import { embedVersion, integrationByKey } from "@/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polled by open embeds so admin changes reach partner sites without a reload.
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  const integration = await integrationByKey(key).catch(() => null);
  return NextResponse.json(
    { version: integration ? await embedVersion(integration) : "missing" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
