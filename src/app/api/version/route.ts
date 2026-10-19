import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export function GET() {
  return NextResponse.json({
    name: packageJson.name,
    version: packageJson.version,
    commit: process.env.GIT_COMMIT_SHA ?? null,
    environment: process.env.NODE_ENV ?? "development",
  });
}
