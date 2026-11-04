import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { initialFields } from "../src/modules/catalog/templates";

test(
  "Compact account submissions survive saving, submitting and approval regardless of admin role",
  {
    skip: !process.env.FORM_TEST_DATABASE_URL,
  },
  async () => {
    const url = new URL(process.env.FORM_TEST_DATABASE_URL!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.pathname.endsWith("_test"),
      "Use a disposable local *_test database only",
    );
    process.env.DATABASE_URL = url.href;
    // Match Next's server-side alias when exercising the data layer outside Next.
    registerHooks({
      resolve(specifier, context, nextResolve) {
        return nextResolve(
          specifier === "server-only"
            ? "next/dist/compiled/server-only/empty.js"
            : specifier,
          context,
        );
      },
    });
    const { pool } = await import("../src/server/db");
    const { saveDraft, submitRevision, moderate } =
      await import("../src/server/catalog");
    const prefix = randomUUID();
    const categoryId = `form-${prefix}`;
    const templateId = randomUUID();
    const reviewer = {
      id: randomUUID(),
      name: "Test reviewer",
      email: `${prefix}-review@example.test`,
      role: "owner",
      emailVerified: true,
    };
    try {
      await pool.query(
        'INSERT INTO "user"(id,name,email,role,email_verified) VALUES($1,$2,$3,$4,true)',
        [reviewer.id, reviewer.name, reviewer.email, reviewer.role],
      );
      await pool.query(
        "INSERT INTO categories(id,name,name_en,color,kind) VALUES($1,'Experiențe','Experiences','#002626','experience')",
        [categoryId],
      );
      await pool.query(
        "INSERT INTO templates(id,category_id,version,fields) VALUES($1,$2,1,$3)",
        [templateId, categoryId, JSON.stringify(initialFields("experience"))],
      );
      for (const role of ["owner", "admin", "moderator", "user"]) {
        const actor = {
          id: randomUUID(),
          name: `Test ${role}`,
          email: `${prefix}-${role}@example.test`,
          role,
          emailVerified: true,
        };
        await pool.query(
          'INSERT INTO "user"(id,name,email,role,email_verified) VALUES($1,$2,$3,$4,true)',
          [actor.id, actor.name, actor.email, role],
        );
        const gallery = Array.from({ length: 4 }, () => randomUUID());
        for (const id of gallery)
          await pool.query(
            "INSERT INTO assets(id,owner_id,object_key,filename,size) VALUES($1,$2,$3,'test.webp',1)",
            [id, actor.id, `${prefix}/${id}.webp`],
          );
        const values = {
          name: `Atelier ${role}`,
          description: "Atelier de test",
          village: "Chișinău",
          latitude: 47.02,
          longitude: 28.83,
          min_people: 1,
          max_people: 8,
          price: 0,
          hours: "09:00–18:00",
          phone: "+37369123456",
          gallery,
        };
        const input = { categoryId, templateId, formMode: "simple", values };
        const saved = await saveDraft(actor, input);
        assert.equal(
          (
            await pool.query(
              "SELECT form_mode FROM listing_revisions WHERE id=$1",
              [saved.revisionId],
            )
          ).rows[0].form_mode,
          "simple",
        );
        await submitRevision(actor, saved.revisionId);
        await moderate(reviewer, saved.revisionId, {
          decision: "approve",
          feedback: "",
        });
        assert.equal(
          (
            await pool.query("SELECT status FROM listings WHERE id=$1", [
              saved.listingId,
            ])
          ).rows[0].status,
          "published",
        );
        if (role === "owner") {
          const full = await saveDraft(actor, { ...input, formMode: "full" });
          await assert.rejects(
            submitRevision(actor, full.revisionId),
            /Regiune/,
          );
          const partial = await saveDraft(actor, {
            ...input,
            values: { ...values, gallery: gallery.slice(0, 3) },
          });
          await assert.rejects(
            submitRevision(actor, partial.revisionId),
            /4–5 fotografii/,
          );
        }
        if (role === "user") {
          const forced = await saveDraft(actor, { ...input, formMode: "full" });
          assert.equal(
            (
              await pool.query(
                "SELECT form_mode FROM listing_revisions WHERE id=$1",
                [forced.revisionId],
              )
            ).rows[0].form_mode,
            "simple",
          );
        }
      }
    } finally {
      await pool.end();
    }
  },
);
