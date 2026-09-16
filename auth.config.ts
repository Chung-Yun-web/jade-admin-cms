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

import type { NextAuthConfig } from "next-auth";

export default {
  // Add a safe fallback secret to ensure NextAuth middleware never crashes in Edge Runtime
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "f0fd0f35285feb32eee1d1c7dbcb0abf83ee40840ab2c81af3415fd82165b10e",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [], // Keep empty for Edge Runtime compatibility inside middleware
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      
      // 1. Paths that do not require authentication
      if (
        pathname === "/login" ||
        pathname === "/unauthorized" ||
        pathname.startsWith("/api/auth")
      ) {
        return true;
      }

      // 2. Check if user is logged in
      const isLoggedIn = !!auth;
      if (!isLoggedIn) {
        return false; // Automatically redirects to pages.signIn ("/login")
      }

      // 3. Admin emails whitelist check
      const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
      const userEmail = auth.user?.email || "";
      if (!adminEmails.includes(userEmail)) {
        return Response.redirect(new URL("/unauthorized", request.nextUrl));
      }

      return true;
    },
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

