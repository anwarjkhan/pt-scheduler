import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export type Role = "CLIENT" | "TRAINER";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

const devLoginEnabled = process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

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
    // Dev-only: sign in as any email without a password. Disabled in production.
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev login",
            credentials: { email: { label: "Email" }, name: { label: "Name" } },
            async authorize(creds) {
              const email = String(creds?.email ?? "").trim().toLowerCase();
              if (!email) return null;
              const name = String(creds?.name ?? email.split("@")[0]);
              const user = await db.user.upsert({
                where: { email },
                update: {},
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
