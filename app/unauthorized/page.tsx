"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldX, LogOut, Loader2 } from "lucide-react";

export default function UnauthorizedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-800 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 selection:bg-[#0B251A] selection:text-white">
      <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200/60 p-8 sm:p-10 shadow-sm flex flex-col items-center text-center">
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 mb-6 shadow-inner animate-pulse">
          <ShieldX className="w-7 h-7 stroke-[1.5]" />
        </div>

        {/* Heading */}
        <h2 className="text-xl font-medium text-red-950 tracking-widest mb-2 font-sans">
          存取遭拒 ACCESS DENIED
        </h2>
        <p className="text-xs text-red-400 tracking-widest uppercase mb-6 font-light">
          未授權的帳號
        </p>

        {/* Current logged in email details */}
        {session?.user?.email && (
          <div className="mb-6 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-stone-600 text-xs tracking-wider">
            <span>當前登入：</span>
            <span className="font-mono text-stone-900 font-normal">{session.user.email}</span>
          </div>
        )}

        <p className="text-xs sm:text-sm text-stone-500 font-light tracking-widest leading-relaxed mb-8 max-w-[320px]">
          您的 Google 帳號不在此系統的管理員白名單內。若您是系統管理員，請確認是否使用了正確的 Google 帳號，或聯絡開發人員。
        </p>

        {/* Log out and try another account */}
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs tracking-[0.2em] font-light py-3.5 px-6 rounded-2xl transition-all shadow-sm cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 stroke-[1.5]" />
          )}
          <span>登出並切換帳號</span>
        </button>
      </div>
    </div>
  );
}
