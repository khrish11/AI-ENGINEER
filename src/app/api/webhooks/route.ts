import { NextResponse } from "next/server";
import { registerWebhook, listWebhooks, deleteWebhook } from "@/lib/webhooks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (localhost allowed for development)
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

// POST /api/webhooks - Register a new webhook
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, events, secret } = body;

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: "url and events array are required" },
        { status: 400 }
      );
    }

    // SSRF Protection: Validate webhook URL
    if (!isValidWebhookUrl(url)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook URL. Only HTTPS URLs are allowed. Private/internal IPs are blocked." },
        { status: 400 }
      );
    }

    // Validate events
    const validEvents = ["lesson.updated", "resource.added", "resource.verified", "project.added"];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid events: ${invalidEvents.join(", ")}. Valid events: ${validEvents.join(", ")}` },
        { status: 400 }
      );
    }

    const webhookId = registerWebhook(url, events, secret);

    return NextResponse.json({
      success: true,
      data: {
        webhookId,
        url,
        events,
        message: "Webhook registered successfully",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to register webhook", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET /api/webhooks - List all webhooks
export async function GET() {
  try {
    const webhooks = listWebhooks();

    return NextResponse.json({
      success: true,
      data: webhooks,
      total: webhooks.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to list webhooks", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks - Delete a webhook
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { webhookId } = body;

    if (!webhookId) {
      return NextResponse.json({ success: false, error: "webhookId required" }, { status: 400 });
    }

    const deleted = deleteWebhook(webhookId);

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Webhook deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete webhook", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
