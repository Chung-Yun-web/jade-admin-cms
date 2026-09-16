// Safeguard for NextAuth environment variables during build or misconfiguration
(() => {
  const checkAndSanitize = (key: string) => {
    const val = process.env[key];
    if (val) {
      const trimmed = val.trim();
      try {
        const parsed = new URL(trimmed);
        if (parsed.hostname === "undefined" || !parsed.hostname) {
          throw new Error("Invalid hostname");
        }
      } catch {
        console.warn(`[Safeguard] Environment variable ${key} has an invalid URL value: "${val}". Overriding to http://localhost:3000 during build.`);
        process.env[key] = "http://localhost:3000";
      }
    }
  };
  checkAndSanitize("AUTH_URL");
  checkAndSanitize("NEXTAUTH_URL");
})();

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

