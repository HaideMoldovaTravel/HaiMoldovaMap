import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./db/schema";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
};
export const isAdmin = (actor: Actor) =>
  ["owner", "admin", "moderator"].includes(actor.role);
export const canConfigure = (actor: Actor) =>
  ["owner", "admin"].includes(actor.role);
export async function currentActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [actor] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, session.user.id));
  return actor ?? null;
}
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) throw new HttpError(401, "Autentifică-te pentru a continua.");
  if (!actor.emailVerified)
    throw new HttpError(403, "Confirmă adresa de email.");
  return actor;
}
export function requireAdmin(actor: Actor, configure = false) {
  if (!(configure ? canConfigure(actor) : isAdmin(actor)))
    throw new HttpError(403, "Nu ai acces la această secțiune.");
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !==
      new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin
  )
    throw new HttpError(403, "Origine invalidă.");
}
