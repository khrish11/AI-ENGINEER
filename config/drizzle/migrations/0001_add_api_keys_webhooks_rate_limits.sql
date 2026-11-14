-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(16) NOT NULL,
  scopes VARCHAR(255) NOT NULL DEFAULT 'read',
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_revoked);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events VARCHAR(255) NOT NULL,
  secret VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

-- Create rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end);
