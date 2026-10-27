import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { postgresPool?: Pool };
export const pool =
  globalDb.postgresPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") globalDb.postgresPool = pool;
export const db = drizzle(pool, { schema });
