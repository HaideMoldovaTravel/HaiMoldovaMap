// Dry run: node --import tsx --env-file=.env scripts/cleanup-catalog.ts
// Apply: add --apply. Restore listing states/pointers: --restore <private backup.json>.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../src/server/db";
import { catalogDecision } from "../src/modules/catalog/cleanup";
import { experienceSubcategories } from "../src/features/places/exploration";
import {
  assertCompatibleFields,
  type ContentField,
} from "../src/modules/catalog/schema";
const apply = process.argv.includes("--apply");
const restoreIndex = process.argv.indexOf("--restore");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  if (restoreIndex !== -1) {
    const backup = JSON.parse(
      readFileSync(process.argv[restoreIndex + 1], "utf8"),
    );
    if (
      backup.database !==
      (await client.query("select current_database() as name")).rows[0].name
    )
      throw new Error("Backupul aparține altei baze.");
    for (const row of backup.listings) {
      await client.query(
        "UPDATE listings SET status=$2,kind=$3,published_revision_id=$4,updated_at=now() WHERE id=$1",
        [row.id, row.status, row.kind, row.published_revision_id],
      );
      await client.query(
        "INSERT INTO audit_log(id,action,resource_id) VALUES($1,'catalog.cleanup.restored',$2)",
        [randomUUID(), row.id],
      );
    }
    await client.query("COMMIT");
    console.log(`Restaurate ${backup.listings.length} fișe.`);
  } else {
    const { rows } =
      await client.query(`SELECT l.*,r.category_id,r.values,r.id AS revision_id
      FROM listings l JOIN listing_revisions r ON r.id=l.published_revision_id
      WHERE l.status='published' ORDER BY r.category_id,r.values->>'name' FOR UPDATE OF l`);
    const decisions = rows.map((row) => ({
      row,
      decision: catalogDecision(row),
    }));
    const changed = decisions.filter(
      ({ row, decision }) =>
        decision.action === "archive" ||
        (decision.action === "reclassify" &&
          decision.category !== row.category_id),
    );
    const report = [
      "# Curățarea catalogului",
      "",
      `Bază: ${(await client.query("select current_database() as name")).rows[0].name}. Fișe publicate analizate: ${rows.length}.`,
      "",
      ...["archive", "reclassify", "keep"].map(
        (action) =>
          `${action}: ${decisions.filter((d) => d.decision.action === action).length}`,
      ),
      "",
      "Retragerea folosește arhivarea. Istoricul, fotografiile și reviziile anterioare se păstrează. Copiile de siguranță sunt private, în `.local-backups/`.",
      "",
      "| ID | Denumire | Categorie inițială | Acțiune | Motiv |",
      "| --- | --- | --- | --- | --- |",
      ...decisions.map(
        ({ row, decision: d }) =>
          `| ${row.id} | ${String(row.values.name).replace(/\|/g, " ")} | ${row.category_id} | ${d.action}${d.category ? ` → ${d.category}` : ""} | ${d.reason} |`,
      ),
      "",
    ].join("\n");
    const reportPath = apply
      ? process.env.APP_ENV === "production"
        ? ".local-backups/cleanup-report-production.md"
        : "docs/curatare-catalog-local.md"
      : ".local-backups/cleanup-preview.md";
    mkdirSync(".local-backups", { recursive: true, mode: 0o700 });
    writeFileSync(reportPath, report, { mode: 0o600 });
    console.log({
      analyzed: rows.length,
      archive: decisions.filter((d) => d.decision.action === "archive").length,
      reclassify: changed.filter((d) => d.decision.action === "reclassify")
        .length,
      apply,
      report: reportPath,
    });
    if (!apply) {
      await client.query("ROLLBACK");
    } else {
      const backupPath = resolve(`.local-backups/cleanup-${Date.now()}.json`);
      const revisions = (
        await client.query(
          "SELECT * FROM listing_revisions WHERE listing_id=ANY($1)",
          [changed.map((d) => d.row.id)],
        )
      ).rows;
      const templateRows = (
        await client.query(
          "SELECT DISTINCT ON(category_id) * FROM templates ORDER BY category_id,version DESC",
        )
      ).rows;
      writeFileSync(
        backupPath,
        JSON.stringify(
          {
            database: (await client.query("select current_database() as name"))
              .rows[0].name,
            listings: changed.map((d) => d.row),
            revisions,
            templates: templateRows,
          },
          null,
          2,
        ),
        { mode: 0o600, flag: "wx" },
      );
      for (const template of templateRows) {
        if (
          template.category_id !== "experience" ||
          template.fields.some(
            (f: ContentField) => f.id === "experience_subcategories",
          )
        )
          continue;
        const fields = assertCompatibleFields(template.fields, [
          ...template.fields,
          {
            id: "experience_subcategories",
            label: "Subcategorii de experiențe",
            labelEn: "Experience subcategories",
            type: "multiselect",
            group: "details",
            public: true,
            required: false,
            help: "",
            options: experienceSubcategories.map((c) => c.id),
          },
        ]);
        await client.query(
          "INSERT INTO templates(id,category_id,version,fields) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            template.category_id,
            template.version + 1,
            JSON.stringify(fields),
          ],
        );
      }
      for (const { row, decision } of changed) {
        if (decision.action === "archive")
          await client.query(
            "UPDATE listings SET status='archived',updated_at=now() WHERE id=$1",
            [row.id],
          );
        else {
          const template = (
            await client.query(
              "SELECT t.*,c.kind FROM templates t JOIN categories c ON c.id=t.category_id WHERE t.category_id=$1 ORDER BY version DESC LIMIT 1",
              [decision.category],
            )
          ).rows[0];
          if (!template)
            throw new Error(`Lipsește categoria ${decision.category}`);
          const values = Object.fromEntries(
            Object.entries(row.values).filter(([key]) =>
              template.fields.some((f: ContentField) => f.id === key),
            ),
          );
          if (decision.subcategories)
            values.experience_subcategories = decision.subcategories;
          const revisionId = randomUUID();
          await client.query(
            `INSERT INTO listing_revisions(id,listing_id,author_id,category_id,template_id,values,point,status,feedback)
            SELECT $1,listing_id,author_id,$2,$3,$4,point,'approved',$5 FROM listing_revisions WHERE id=$6`,
            [
              revisionId,
              decision.category,
              template.id,
              JSON.stringify(values),
              decision.reason,
              row.revision_id,
            ],
          );
          await client.query(
            "UPDATE listings SET kind=$2,published_revision_id=$3,updated_at=now() WHERE id=$1",
            [row.id, template.kind, revisionId],
          );
        }
        await client.query(
          "INSERT INTO audit_log(id,action,resource_id) VALUES($1,$2,$3)",
          [randomUUID(), `catalog.cleanup.${decision.action}`, row.id],
        );
      }
      await client.query("COMMIT");
      console.log(`Curățare aplicată. Backup privat: ${backupPath}`);
    }
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
