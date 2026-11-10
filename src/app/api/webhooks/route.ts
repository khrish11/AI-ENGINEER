import { NextRequest, NextResponse } from "next/server";
import { registerWebhook, listWebhooks, deleteWebhook } from "@/lib/webhooks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
