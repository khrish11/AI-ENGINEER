import { getWebhooksForEvent } from "./store";
import { createHmac, randomBytes } from "node:crypto";

export async function triggerWebhook(event: string, data: Record<string, unknown>) {
  const webhooks = getWebhooksForEvent(event);

  for (const webhook of webhooks) {
    try {
      // SSRF Protection: Validate webhook URL
      if (!isValidWebhookUrl(webhook.url)) {
        console.error(`Invalid webhook URL for ${webhook.id}: ${webhook.url}`);
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
        // Timeout to prevent hanging on malicious endpoints
        signal: AbortSignal.timeout(10000), // 10 second timeout
        // Prevent following redirects
        redirect: "manual",
      });

      if (!response.ok) {
        console.error(`Webhook ${webhook.id} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  }
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (localhost allowed for development)
    // In production, should add environment variable check to reject localhost
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }

    const hostname = parsed.hostname;

    // Explicitly allow localhost for development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // Block private/internal IPs (IPv4)
    const privateIPv4 = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.|169\.254\.)/;
    if (privateIPv4.test(hostname)) {
      return false;
    }

    // Block IPv6 internal addresses
    if (hostname.includes("::") || hostname.startsWith("fe80:") || hostname.startsWith("fc00:") || hostname.startsWith("fd")) {
      return false;
    }

    // Block metadata endpoints
    if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") {
      return false;
    }

    // Block internal DNS resolution attempts
    if (hostname.endsWith(".internal") || hostname.endsWith(".local") || hostname.endsWith(".corp")) {
      return false;
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
