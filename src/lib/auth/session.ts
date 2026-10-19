import { auth, isAuthConfigured, configuredProviders } from "@/auth";

export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUserId(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  }
  return userId;
}

export function getAuthPublicStatus() {
  return {
    configured: isAuthConfigured(),
    providers: configuredProviders,
    developmentHint: isAuthConfigured()
      ? null
      : "OAuth is not configured. Set AUTH_SECRET plus GitHub and/or Google credentials. Guest Mode remains fully usable.",
  };
}
