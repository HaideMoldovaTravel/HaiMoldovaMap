import { currentActor } from "@/server/access";
import { assetAllowed } from "@/server/catalog";
import { getImage } from "@/server/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const allowed = await assetAllowed(id, await currentActor());
  if (!allowed)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const object = await getImage(allowed.asset.key);
  const bytes = await object.Body!.transformToByteArray();
  return new Response(new Uint8Array(bytes).buffer, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
