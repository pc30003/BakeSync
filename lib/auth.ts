import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        // ── Demo mode: skip password check entirely ──────────────────────
        if (IS_DEMO) return user;

        // ── Production mode: require bcrypt hash ─────────────────────────
        if (!user.password) return null;  // OAuth-only account — deny credentials login

        const bcrypt = await import("bcryptjs");
        const valid  = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return user;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await db.user.findUnique({
          where:  { id: user.id },
          select: { id: true, role: true, bakeryId: true },
        });
        token.id       = dbUser?.id;
        token.role     = dbUser?.role;
        token.bakeryId = dbUser?.bakeryId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id       = token.id       as string;
        session.user.role     = token.role     as UserRole;
        session.user.bakeryId = token.bakeryId as string;
      }
      return session;
    },
  },
});

// ─── NextAuth type augmentation ──────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id:       string;
      name:     string | null;
      email:    string;
      image:    string | null;
      role:     UserRole;
      bakeryId: string;
    };
  }
}
