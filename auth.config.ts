import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // In lightweight middleware contexts, check the email whitelist
        const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
        if (adminEmails.includes(session.user.email || "")) {
          (session.user as any).role = "admin";
        } else {
          (session.user as any).role = "general";
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

