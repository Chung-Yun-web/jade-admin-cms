import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Paths that do not require authentication
  if (
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // If no session, redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin emails whitelist check
  const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
  if (
    !session.user ||
    !session.user.email ||
    !adminEmails.includes(session.user.email)
  ) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (excluding some api files if needed, but standard is to protect pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - file.svg, globe.svg, next.svg, vercel.svg, window.svg (public images)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|file.svg|globe.svg|next.svg|vercel.svg|window.svg).*)",
  ],
};

