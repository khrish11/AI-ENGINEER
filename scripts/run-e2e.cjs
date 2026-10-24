// E2E support: outer runner. Sets the isolated test environment (disposable AUTH_SECRET, dummy
// OAuth creds, local test DB, dedicated port) and delegates to Playwright, which passes this env
// down to the webServer (scripts/start-e2e-server.cjs) and to globalSetup (e2e/global-setup.ts).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const authDir = path.join("playwright", ".auth");
fs.mkdirSync(authDir, { recursive: true });
const SECRET_FILE = path.join(authDir, "e2e-secret.txt");
if (!fs.existsSync(SECRET_FILE)) {
  fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("base64"));
}

const localDb = fs
  .readFileSync(".env.local", "utf8")
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^"|"$/g, "");

if (!/localhost|127\.0\.0\.1/.test(localDb)) {
  console.error("refusing to run e2e: .env.local DATABASE_URL is not a localhost database");
  process.exit(1);
}

const env = {
  ...process.env,
  E2E_AUTH_SECRET: fs.readFileSync(SECRET_FILE, "utf8").trim(),
  AUTH_SECRET: fs.readFileSync(SECRET_FILE, "utf8").trim(),
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "e2e-dummy.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "e2e-dummy-secret",
  DATABASE_URL: localDb,
  E2E_PORT: process.env.E2E_PORT || "3300",
};

const res = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  shell: true,
});
process.exit(res.status ?? 1);
