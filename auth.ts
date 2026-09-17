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
        (session.user as any).isNewUser = token.isNewUser || false;
        
        // Query MongoDB for the latest role dynamically
        try {
          if (session.user.email) {
            const client = await clientPromise;
            const db = client.db();
            const dbUser = await db.collection("users").findOne(
              { email: session.user.email },
              { projection: { role: 1 } }
            );
            (session.user as any).role = dbUser?.role || (token.role as string) || "general";
          } else {
            (session.user as any).role = (token.role as string) || "general";
          }
        } catch (err) {
          console.error("Error fetching user role for session:", err);
          (session.user as any).role = (token.role as string) || "general";
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

export function isUserAdmin(session: any): boolean {
  return session?.user?.role === "admin";
}


