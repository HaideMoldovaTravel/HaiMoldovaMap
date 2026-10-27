import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { queueMail, linkEmail } from "./mail";
export const auth = betterAuth({
  appName: "Hai Moldova",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await queueMail(
        user.email,
        "Resetează parola — Hai Moldova",
        linkEmail(
          "Am primit o cerere de resetare a parolei pentru contul tău Hai Moldova. Apasă butonul de mai jos ca să alegi o parolă nouă.",
          url,
          "Alege o parolă nouă",
          {
            eyebrow: "Resetare parolă",
            title: "Setează o parolă nouă",
            note: "Dacă nu ai cerut resetarea, ignoră acest mesaj. Parola ta rămâne neschimbată.",
          },
        ),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await queueMail(
        user.email,
        "Confirmă emailul — Hai Moldova",
        linkEmail(
          `Bun venit${user.name ? `, ${user.name}` : ""}! Mai e un pas: confirmă adresa de email ca să poți adăuga locuri și experiențe pe harta Hai Moldova.`,
          url,
          "Confirmă emailul",
          {
            eyebrow: "Confirmare email",
            title: "Confirmă-ți adresa de email",
            note: "Linkul este valabil o oră. Dacă nu ți-ai creat cont pe Hai Moldova, ignoră acest mesaj.",
          },
        ),
      );
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      "/send-verification-email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
});
