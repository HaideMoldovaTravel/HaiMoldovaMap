import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/server/db";
await migrate(db, { migrationsFolder: "drizzle" });
console.log("Database migrations applied.");
await pool.end();
