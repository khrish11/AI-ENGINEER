// Simple in-memory webhook storage (for production, use database)
const WEBHOOKS = new Map<string, { url: string; events: string[]; secret: string; createdAt: number }>();

export function registerWebhook(url: string, events: string[], secret?: string): string {
  const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  WEBHOOKS.set(id, {
    url,
    events,
    secret: secret || generateSecret(),
    createdAt: Date.now(),
  });
  return id;
}

export function getWebhook(id: string) {
  return WEBHOOKS.get(id);
}

export function deleteWebhook(id: string): boolean {
  return WEBHOOKS.delete(id);
}

export function listWebhooks() {
  return Array.from(WEBHOOKS.entries()).map(([id, hook]) => ({
    id,
    url: hook.url,
    events: hook.events,
    createdAt: hook.createdAt,
  }));
}

export function getWebhooksForEvent(event: string) {
  return Array.from(WEBHOOKS.entries())
    .filter(([_, hook]) => hook.events.includes(event))
    .map(([id, hook]) => ({ id, ...hook }));
}

function generateSecret(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
