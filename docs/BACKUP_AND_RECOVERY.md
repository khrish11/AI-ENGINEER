# Backup and Recovery

## PostgreSQL backups

Run backups from a trusted host with `DATABASE_URL` set:

```sh
pg_dump "$DATABASE_URL" --format=custom --file=ai-engineer-os.dump
pg_restore --list ai-engineer-os.dump
pg_restore --clean --if-exists --dbname="$DATABASE_URL" ai-engineer-os.dump
```

Keep database backups encrypted and separate from application credentials. Take a
backup before applying a migration that changes constraints or data.

## Learner export

Authenticated users can export their learning data from the account settings
surface. Exports use the versioned JSON format shown by the export response and
never include OAuth secrets, provider tokens, or session credentials.

Local guest progress is stored in IndexedDB. It can be exported from the guest
settings surface, but browser storage cannot be recovered from a server backup.
Users should export guest data before clearing browser storage or uninstalling a
browser profile.

## Restore and migrations

Restore PostgreSQL into an isolated database first, apply migrations, and run
`npm run db:audit` before switching application traffic. Migrations are
additive by default. When a migration cannot be safely rolled back, use a
forward fix from a verified backup rather than editing migration history.

## Release recovery checklist

1. Stop writes or put the application in maintenance mode.
2. Capture a fresh PostgreSQL dump.
3. Restore and validate in an isolated database.
4. Apply pending migrations and run `npm run db:audit`.
5. Verify authenticated export and public portfolio privacy.
6. Switch traffic only after the checks pass.
