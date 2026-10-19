# Local Development

Use Node 20 or 24 and npm with the committed lockfile:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Guest Mode works without OAuth credentials. PostgreSQL-backed features require a local PostgreSQL instance configured through `.env.local`; never point development or CI at the unrelated Neon database.

Before opening a pull request, run `npm run validate`. Use `npm run validate:full` for the build and Playwright gate. Run `npm run mcp:start` to start the local read-only adapter.
