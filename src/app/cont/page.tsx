import { redirect } from "next/navigation";
import { currentActor } from "@/server/access";
import { dashboard } from "@/server/catalog";
import { Dashboard } from "@/components/platform/dashboard";
import type { DashboardData } from "@/components/platform/types";
import "@/components/platform/platform.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await currentActor();
  if (!actor || !actor.emailVerified) redirect("/autentificare?returnTo=/cont");
  const data = await dashboard(actor);
  // Serialize timestamps explicitly at the server/client boundary.
  return (
    <Dashboard initial={JSON.parse(JSON.stringify(data)) as DashboardData} />
  );
}
