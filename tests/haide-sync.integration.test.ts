import { test } from "node:test";
import assert from "node:assert/strict";

test(
  "Haide synchronization is atomic, idempotent, withdraws only complete exports and respects overrides",
  { skip: !process.env.HAIDE_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.HAIDE_TEST_DATABASE_URL!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.pathname.endsWith("_test"),
      "Use a disposable local *_test database only",
    );
    process.env.DATABASE_URL = url.href;
    process.env.HAIDE_API_URL = "https://api.haide.test/api/";
    process.env.HAIDE_SITE_URL = "https://haide.test";
    process.env.HAIDE_SYNC_TOKEN = "test-only-".repeat(5);
    process.env.HAIDE_CATEGORY_MAP = JSON.stringify({
      experience: "haide-test-exp",
      guesthouse: "haide-test-loc",
      accommodation: "haide-test-stay",
    });
    const { pool } = await import("../src/server/db");
    const { syncHaide, importedHaidePlaces, HaideSyncBusy } =
      await import("../src/server/haide/sync");
    const originalFetch = globalThis.fetch;
    let items = [
      {
        type: "experience",
        id: "1",
        organization_id: "1",
        name: "Approved",
        name_en: "Approved",
        description: "Public",
        description_en: "Public",
        city: "Orhei",
        latitude: 47.38 as number | null,
        longitude: 28.82,
        images: [],
        price: 150,
        currency: "MDL",
        bookable: true,
        url: "https://haide.test/ro/experiences/one",
      },
    ];
    let fail = false,
      incomplete = false;
    globalThis.fetch = async () => {
      if (fail) throw new Error("Offline");
      return Response.json({
        version: 1,
        snapshot: "f5c2d43c-44c1-44a8-80ee-ec27b9daea4c",
        page: 1,
        pages: 1,
        total: incomplete ? 999 : items.length,
        items,
      });
    };
    try {
      await pool.query("TRUNCATE haide_catalog,haide_sync_runs");
      for (const [id, kind] of [
        ["haide-test-exp", "experience"],
        ["haide-test-loc", "location"],
        ["haide-test-stay", "location"],
      ])
        await pool.query(
          "INSERT INTO categories(id,name,name_en,color,kind) VALUES($1,$1,$1,'#002626',$2) ON CONFLICT DO NOTHING",
          [id, kind],
        );
      await syncHaide();
      await syncHaide();
      assert.equal(
        (await pool.query("SELECT count(*) FROM haide_catalog")).rows[0].count,
        "1",
      );
      assert.equal((await importedHaidePlaces())[0].name, "Approved");
      items[0].name = "New approved title";
      await syncHaide();
      assert.equal((await importedHaidePlaces())[0].name, "New approved title");
      fail = true;
      await assert.rejects(syncHaide());
      fail = false;
      incomplete = true;
      await assert.rejects(syncHaide());
      assert.equal((await importedHaidePlaces()).length, 1);
      incomplete = false;
      await pool.query("UPDATE haide_catalog SET suppressed=true");
      await syncHaide();
      assert.equal((await importedHaidePlaces()).length, 0);
      assert.equal(
        (await pool.query("SELECT suppressed FROM haide_catalog")).rows[0]
          .suppressed,
        true,
      );
      await pool.query("UPDATE haide_catalog SET suppressed=false");
      items[0].latitude = null;
      await syncHaide();
      assert.equal((await importedHaidePlaces()).length, 0);
      assert.equal(
        (await pool.query("SELECT issue FROM haide_catalog")).rows[0].issue,
        "Lipsesc coordonatele",
      );
      items[0].latitude = 47.38;
      await syncHaide();
      assert.equal((await importedHaidePlaces()).length, 1);
      const client = await pool.connect();
      await client.query("SELECT pg_advisory_lock(74119,1)");
      try {
        await assert.rejects(syncHaide(), HaideSyncBusy);
      } finally {
        await client.query("SELECT pg_advisory_unlock(74119,1)");
        client.release();
      }
      items = [];
      const result = await syncHaide();
      assert.equal(result.hidden, 1);
      assert.equal((await importedHaidePlaces()).length, 0);
      assert.equal(
        (await pool.query("SELECT count(*) FROM haide_catalog")).rows[0].count,
        "1",
        "Withdrawal retains local history",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM haide_sync_runs WHERE status='failed'",
          )
        ).rows[0].count,
        "2",
      );
    } finally {
      globalThis.fetch = originalFetch;
      await pool.end();
    }
  },
);
