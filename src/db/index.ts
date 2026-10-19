import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let sql: ReturnType<typeof postgres> | null = null;

export function getDbClient(): ReturnType<typeof postgres> {
  if (!sql) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://ai_engineer_os:local_dev_password@localhost:5432/ai_engineer_os";

    // `prepare: false` is required when using postgres-js with Drizzle ORM,
    // since Drizzle manages its own prepared-statement caching.
    sql = postgres(connectionString, { prepare: false });
  }
  return sql;
}

export const db = drizzle(getDbClient());
export { schema };
