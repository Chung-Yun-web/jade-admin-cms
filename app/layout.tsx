import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const getMetadataBase = () => {
  let url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname && parsed.hostname !== "undefined") {
      return parsed;
    }
  } catch {
    // fallback below
  }
  return new URL("http://localhost:3000");
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "巧鈺好飾 CMS 後台管理系統",
  description: "巧鈺好飾 JADE Meet Metal | 後台管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-stone-50/50">
        <SessionProvider>
          <Toaster position="top-center" reverseOrder={false} />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

