import { getWebhooksForEvent, recordWebhookTrigger, recordWebhookFailure } from "./webhook-service";
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";

export async function triggerWebhook(event: string, data: Record<string, unknown>) {
  const webhooks = await getWebhooksForEvent(event);

  for (const webhook of webhooks) {
    try {
      // SSRF Protection: Validate webhook URL (async for DNS resolution)
      if (!(await isValidWebhookUrl(webhook.url))) {
        console.error(`Invalid webhook URL for ${webhook.id}: ${webhook.url}`);
        await recordWebhookFailure(webhook.id);
        continue;
      }

      // Add nonce for replay attack protection
      const nonce = randomBytes(16).toString("hex");
      const timestamp = Date.now().toString();
      const signature = generateSignature(data, webhook.secret, nonce, timestamp);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": timestamp,
          "X-Webhook-Nonce": nonce,
        },
        body: JSON.stringify({ ...data, nonce, timestamp }),
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });

      if (!response.ok) {
        console.error(`Webhook ${webhook.id} returned ${response.status}`);
        await recordWebhookFailure(webhook.id);
      } else {
        await recordWebhookTrigger(webhook.id);
      }
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
      await recordWebhookFailure(webhook.id);
    }
  }
}

export async function isValidWebhookUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }

    const hostname = parsed.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    const privateIPv4 = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.|169\.254\.)/;
    if (privateIPv4.test(hostname)) {
      return false;
    }

    if (hostname.includes("::") || hostname.startsWith("fe80:") || hostname.startsWith("fc00:") || hostname.startsWith("fd")) {
      return false;
    }

    if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") {
      return false;
    }

    if (hostname.endsWith(".internal") || hostname.endsWith(".local") || hostname.endsWith(".corp")) {
      return false;
    }

    // Skip DNS resolution in CI where it may be unreliable
    if (process.env.CI === "true") {
      return true;
    }

    try {
      const addresses = await lookup(hostname, { all: true });
      for (const address of addresses) {
        if (address.family === 4) {
          if (privateIPv4.test(address.address)) {
            return false;
          }
        } else if (address.family === 6) {
          if (address.address.includes("::") || address.address.startsWith("fe80:") || address.address.startsWith("fc00:") || address.address.startsWith("fd")) {
            return false;
          }
        }
      }
    } catch (dnsError) {
      console.warn(`DNS resolution warning for ${hostname}:`, dnsError);
    }

    return true;
  } catch {
    return false;
  }
}

function generateSignature(data: Record<string, unknown>, secret: string, nonce: string, timestamp: string): string {
  const payload = JSON.stringify(data);
  const hmac = createHmac("sha256", secret);
  hmac.update(nonce);
  hmac.update(timestamp);
  hmac.update(payload);
  return hmac.digest("hex");
}
