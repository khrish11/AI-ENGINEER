import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";

const GITHUB_ID = process.env.AUTH_GITHUB_ID;
const GITHUB_SECRET = process.env.AUTH_GITHUB_SECRET;
const GOOGLE_ID = process.env.AUTH_GOOGLE_ID;
const GOOGLE_SECRET = process.env.AUTH_GOOGLE_SECRET;
const AUTH_SECRET = process.env.AUTH_SECRET;

const providers = [];

if (GITHUB_ID && GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: GITHUB_ID,
      clientSecret: GITHUB_SECRET,
    })
  );
}

if (GOOGLE_ID && GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: GOOGLE_ID,
      clientSecret: GOOGLE_SECRET,
    })
  );
}

export function isAuthConfigured(): boolean {
  return Boolean(AUTH_SECRET && providers.length > 0);
}

export const configuredProviders = providers.map((provider) => provider.id);

async function upsertAuthUser(params: {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  image: string | null;
}): Promise<string> {
  const email =
    params.email ?? `${params.provider}-${params.providerAccountId}@users.noreply.local`;

  const existingAccount = await db
    .select()
    .from(accounts)
    .where(eq(accounts.providerAccountId, params.providerAccountId))
    .limit(1);

  if (existingAccount[0]) {
    return existingAccount[0].userId;
  }

  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const userId = existingUser[0]?.id;

  if (!userId) {
    const inserted = await db
      .insert(users)
      .values({
        email,
        name: params.name,
        image: params.image,
      })
      .returning({ id: users.id });
    const newId = inserted[0].id;
    await db.insert(accounts).values({
      userId: newId,
      type: "oauth",
      provider: params.provider,
      providerAccountId: params.providerAccountId,
    });
    return newId;
  }

  await db.insert(accounts).values({
    userId,
    type: "oauth",
    provider: params.provider,
    providerAccountId: params.providerAccountId,
  });
  return userId;
}

const nextAuth = NextAuth({
  secret: AUTH_SECRET ?? "dev-only-unconfigured-secret",
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers,
  pages: {
    signIn: "/settings",
    error: "/settings",
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account && isAuthConfigured()) {
        const userId = await upsertAuthUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user?.email ?? (profile?.email as string | undefined) ?? null,
          name: user?.name ?? (profile?.name as string | undefined) ?? null,
          image: user?.image ?? (profile?.picture as string | undefined) ?? null,
        });
        token.userId = userId;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
      }
      return session;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;

/**
 * Check if the current session is authenticated (not guest mode)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return session?.user?.id !== undefined && session.user.id !== "";
}
