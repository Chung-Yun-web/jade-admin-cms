import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./lib/mongodb";
import authConfig from "./auth.config";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  ...authConfig,
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
  events: {
    async createUser({ user }) {
      try {
        const client = await clientPromise;
        const db = client.db();
        if (user.email) {
          await db.collection("users").updateOne(
            { email: user.email },
            { $set: { role: "user", member: "general", isNewUser: true } }
          );
          console.log(`Successfully assigned user role and general member status to new user: ${user.email}`);
        }
      } catch (err) {
        console.error("Error setting default role and member status for new user:", err);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role || "general";
        (session.user as any).isNewUser = token.isNewUser || false;
        
        // Assign admin role if email is in the administrator whitelist
        const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
        if (adminEmails.includes(session.user.email || "")) {
          (session.user as any).role = "admin";
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "general";
        token.isNewUser = (user as any).isNewUser || false;
      }
      return token;
    }
  },
});

