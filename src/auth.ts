import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export type Role = "CLIENT" | "TRAINER";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

// Password-free sign-in. Locally: DEV_LOGIN=true is enough. In production it also
// needs DEMO_MODE=true and a DEMO_PASSCODE that the sign-in form must supply, so a
// deployed demo is not an open door to the trainer account.
const demoMode = process.env.DEMO_MODE === "true";
const demoPasscode = process.env.DEMO_PASSCODE?.trim();
const devLoginEnabled =
  process.env.DEV_LOGIN === "true" &&
  (process.env.NODE_ENV !== "production" || (demoMode && !!demoPasscode));

function roleForEmail(email: string | null | undefined): Role {
  const pt = process.env.PT_EMAIL?.trim().toLowerCase();
  return pt && email?.toLowerCase() === pt ? "TRAINER" : "CLIENT";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google,
    // Apple only when configured (needs AUTH_APPLE_ID + AUTH_APPLE_SECRET client-secret JWT).
    ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET ? [Apple] : []),
    // Dev-only: sign in as any email without a password. Disabled in production.
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev login",
            credentials: { email: { label: "Email" }, name: { label: "Name" }, passcode: { label: "Passcode" } },
            async authorize(creds) {
              // In production the shared demo passcode is required.
              if (demoPasscode && String(creds?.passcode ?? "") !== demoPasscode) return null;
              const email = String(creds?.email ?? "").trim().toLowerCase();
              if (!email) return null;
              const typedName = String(creds?.name ?? "").trim();
              const name = typedName || email.split("@")[0];
              const user = await db.user.upsert({
                where: { email },
                update: typedName ? { name: typedName } : {},
                create: { email, name, role: roleForEmail(email) },
              });
              return user;
            },
          }),
        ]
      : []),
  ],
  events: {
    // Promote the configured PT account on first sign-in.
    async createUser({ user }) {
      if (user.email && roleForEmail(user.email) === "TRAINER") {
        await db.user.update({ where: { id: user.id! }, data: { role: "TRAINER" } });
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Fetch role from DB so promotions apply on next sign-in.
        const dbUser = await db.user.findUnique({ where: { id: user.id! }, select: { role: true } });
        token.role = dbUser?.role ?? "CLIENT";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as Role) ?? "CLIENT";
      return session;
    },
  },
});

export const isDevLoginEnabled = devLoginEnabled;
/** True when the dev-login form must also collect the shared demo passcode. */
export const isDemoPasscodeRequired = devLoginEnabled && !!demoPasscode;
