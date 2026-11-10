import { NextRequest, NextResponse } from "next/server";
import { generateApiKey, listApiKeys, deleteApiKey } from "@/lib/auth/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: In production, add admin authentication here
// For now, this is a simple endpoint for demonstration

// POST /api/admin/api-keys - Generate new API key
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = body.name || "default";

    const apiKey = generateApiKey(name);

    return NextResponse.json({
      success: true,
      data: {
        apiKey,
        name,
        message: "Store this key securely. It will not be shown again.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/api-keys - List all API keys
export async function GET() {
  try {
    const keys = listApiKeys();

    return NextResponse.json({
      success: true,
      data: keys,
      total: keys.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list API keys",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/api-keys - Delete an API key
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: "API key required",
        },
        { status: 400 }
      );
    }

    const deleted = deleteApiKey(key);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: "API key not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API key deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
