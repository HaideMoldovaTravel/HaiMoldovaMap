import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { currentActor, isAdmin } from "@/server/access";
import { db } from "@/server/db";
import { revisions } from "@/server/db/schema";
import { AdminShell } from "@/components/admin/shell";
import "@/components/platform/platform.css";
import "@/components/admin/admin.css";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  if (!actor || !actor.emailVerified) {
    const target = (await headers()).get("x-return-to") ?? "/admin";
    redirect(
      `/autentificare?returnTo=${encodeURIComponent(target.startsWith("/admin") ? target : "/admin")}`,
    );
  }
  if (!isAdmin(actor)) redirect("/cont");
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(revisions)
    .where(eq(revisions.status, "pending"));
  return (
    <AdminShell actor={actor} pending={pending.count}>
      {children}
    </AdminShell>
  );
}
