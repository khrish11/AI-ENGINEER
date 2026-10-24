// E2E support: serve the BUILT standalone production bundle on E2E_PORT with an ISOLATED
// disposable auth secret and dummy OAuth creds (a `next dev` server cannot coexist with a
// developer's running dev server — they share one .next dev lock). process.env takes
// precedence over .env files, so the real AUTH_SECRET is never used by the test server.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

// Secret ownership: the outer `run-e2e` wrapper normally provides E2E_AUTH_SECRET via env.
// Fall back to the gitignored secret file (generate once) for direct `playwright test` runs.
const authDir = path.join("playwright", ".auth");
fs.mkdirSync(authDir, { recursive: true });
const SECRET_FILE = path.join(authDir, "e2e-secret.txt");
if (!process.env.E2E_AUTH_SECRET && !fs.existsSync(SECRET_FILE)) {
  fs.writeFileSync(SECRET_FILE, require("node:crypto").randomBytes(32).toString("base64"));
}
const secret = process.env.E2E_AUTH_SECRET || fs.readFileSync(SECRET_FILE, "utf8").trim();
const port = process.env.E2E_PORT || "3300";

const env = {
  ...process.env,
  AUTH_SECRET: secret,
  AUTH_URL: `http://localhost:${port}`,
  AUTH_TRUST_HOST: "true",
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "e2e-dummy.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "e2e-dummy-secret",
  E2E_AUTH_SECRET: secret,
  PORT: port,
  HOSTNAME: "127.0.0.1",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, ""),
};

if (!fs.existsSync(path.join(".next", "BUILD_ID"))) {
  console.error(".next build is missing — run `npm run build` before the e2e suite");
  process.exit(1);
}

const child = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit", shell: true });
child.on("exit", (c) => process.exit(c ?? 0));
