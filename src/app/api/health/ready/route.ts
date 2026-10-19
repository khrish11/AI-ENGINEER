import { NextResponse } from "next/server";
import { getDbClient } from "@/db";
import { parseEnvironment } from "@/lib/config/env";

export const runtime = "nodejs";

export async function GET() {
  try {
    parseEnvironment();
    const sql = getDbClient();
    const rows = await sql<{ reg: string | null; app_name: string | null }[]>`
      SELECT
        to_regclass('public.app_metadata') AS reg,
        (SELECT value FROM app_metadata WHERE key = 'app_name') AS app_name
    `;
    if (rows[0]?.reg !== "app_metadata" || rows[0]?.app_name !== "ai-engineer-os") {
      return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}
