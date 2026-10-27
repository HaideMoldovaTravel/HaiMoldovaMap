import { currentActor } from "@/server/access";
import { AcceptInvite } from "@/components/platform/accept-invite";
import "@/components/platform/platform.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const actor = await currentActor();
  return (
    <main className="platform-shell">
      <AcceptInvite token={token} signedIn={!!actor?.emailVerified} />
    </main>
  );
}
