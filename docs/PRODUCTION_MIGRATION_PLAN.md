# Production Migration Plan

## Database Migration: `0001_add_api_keys_webhooks_rate_limits.sql`

### Pre-Migration Checklist

- [ ] Create database backup
- [ ] Verify database version compatibility (PostgreSQL 12+)
- [ ] Review migration file for schema changes
- [ ] Test migration on staging/development database
- [ ] Prepare rollback plan (note: no down migration exists)

### Migration Steps

1. **Backup Database**
   ```bash
   # Using pg_dump
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # Or use Vercel Postgres backup (if applicable)
   ```

2. **Verify Schema**
   - Current `users` table exists
   - No existing `api_keys`, `webhooks`, or `rate_limits` tables
   - `users` table can accept new `role` column

3. **Apply Migration**
   ```bash
   # Using Drizzle kit
   npx drizzle-kit push

   # Or apply SQL directly
   psql $DATABASE_URL < config/drizzle/migrations/0001_add_api_keys_webhooks_rate_limits.sql
   ```

4. **Verify Migration**
   ```sql
   -- Check new columns
   \d users
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'role';

   -- Check new tables
   \d api_keys
   \d webhooks
   \d rate_limits

   -- Verify constraints
   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name IN ('api_keys', 'webhooks', 'rate_limits');
   ```

### Migration Details

#### Changes to `users` table
- Adds `role VARCHAR(20) NOT NULL DEFAULT 'user'`
- Existing users automatically get `role = 'user'`
- No data loss expected

#### New `api_keys` table
- UUID primary key
- `user_id` foreign key with CASCADE delete
- `key_hash` unique index (SHA-256 hash of API key)
- `key_prefix` for display purposes (first 16 chars)
- `scopes` comma-separated list
- `expires_at` nullable timestamp
- `revoked_at` nullable timestamp
- Timestamps for creation and updates

#### New `webhooks` table
- UUID primary key
- `user_id` foreign key with CASCADE delete
- `url` for webhook destination
- `events` comma-separated list
- `secret` for HMAC signature verification
- `active` boolean flag
- `last_delivery_at` and `failure_count` for monitoring
- Timestamps for creation and updates

#### New `rate_limits` table
- Composite primary key on `(identifier, endpoint, window_start)`
- `identifier` (IP address or API key prefix)
- `endpoint` API path
- `window_start` timestamp for rate limit window
- `request_count` for tracking
- Indexes for efficient lookup and cleanup

### Rollback Plan

**WARNING**: No down migration exists. Rollback requires manual steps:

1. **Stop Application** - Prevent new data writes
2. **Backup Current State** - Export any new data
3. **Drop New Tables**
   ```sql
   DROP TABLE IF EXISTS rate_limits;
   DROP TABLE IF EXISTS webhooks;
   DROP TABLE IF EXISTS api_keys;
   ```
4. **Remove Column**
   ```sql
   ALTER TABLE users DROP COLUMN IF EXISTS role;
   ```
5. **Restore from Backup** - If data loss occurred

### Deployment Order

1. **Apply Database Migration** (during low-traffic window)
2. **Deploy Application Code** (merge PR #5 to main)
3. **Vercel Auto-Deploy** (triggers on main branch push)
4. **Configure Environment Variables** (if not already set)
5. **Verify Health** - Check API endpoints and authentication
6. **Monitor** - Watch for errors in logs and metrics

### First Admin Provisioning

**Method**: Manual database update after migration

1. **Identify User** - Find the user to promote (e.g., via email)
   ```sql
   SELECT id, email, name FROM users WHERE email = 'admin@example.com';
   ```

2. **Promote to Admin**
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
   ```

3. **Verify**
   ```sql
   SELECT id, email, role FROM users WHERE role = 'admin';
   ```

4. **User Signs In** - User authenticates via Google OAuth
5. **Session Created** - Auth.js creates session with admin role
6. **API Key Creation** - User can now create API keys via `/api/admin/api-keys`

**DO NOT** promote production users during initial deployment. Wait for explicit approval.

### Environment Variables Required

Ensure these are set in production environment:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Auth.js
AUTH_SECRET=<generate with openssl rand -base64 32>
AUTH_GITHUB_ID=<your GitHub OAuth app ID>
AUTH_GITHUB_SECRET=<your GitHub OAuth app secret>
AUTH_GOOGLE_ID=<your Google OAuth client ID>
AUTH_GOOGLE_SECRET=<your Google OAuth client secret>

# MCP
MCP_ALLOWED_ORIGINS=<comma-separated list of allowed origins>
MCP_RATE_LIMIT_REQUESTS=60
MCP_RATE_LIMIT_WINDOW_MS=60000
```

### Post-Migration Verification

- [ ] Application starts without errors
- [ ] Google OAuth sign-in works
- [ ] Regular users can create API keys via `/api/user/api-keys`
- [ ] Admin users can create API keys via `/api/admin/api-keys`
- [ ] Rate limiting headers appear in responses
- [ ] Webhook registration works for authenticated users
- [ ] Existing MCP endpoint continues to work
- [ ] No errors in application logs

### Risk Assessment

**Low Risk**:
- Adding `role` column with default value (non-breaking)
- New tables (isolated from existing data)

**Medium Risk**:
- No down migration (rollback requires manual steps)
- Rate limiting depends on PostgreSQL (additive dependency)

**Mitigation**:
- Database backup before migration
- Apply during low-traffic window
- Monitor closely after deployment
- Have rollback steps documented and tested on staging

### Monitoring After Deployment

- Watch for database connection errors
- Monitor rate limit table growth
- Check webhook delivery success rates
- Track API key creation and usage
- Monitor authentication failures
- Check error logs for unexpected issues
