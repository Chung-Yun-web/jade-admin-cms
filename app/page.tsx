"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { ShieldAlert, ShieldX, LogOut, Loader2 } from "lucide-react";
import AdminDashboard from "./AdminDashboard";

export default function AdminRootPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  // 1. 載入狀態
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-800 animate-spin"/>
        <span className="text-sm text-stone-500 font-light tracking-widest">
          正在驗證管理員身分...
        </span>
      </div>
    );
  }

  // 2. 未登入狀態：原地顯示登入介面（不執行 redirect）
  if (status === "unauthenticated" || !session?.user) {
    const handleLogin = async () => {
      setIsLoading(true);
      try {
        await signIn("google");
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 selection:bg-[#0B251A] selection:text-white">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200/60 p-8 sm:p-10 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100/80 mb-6 shadow-inner">
            <ShieldAlert className="w-7 h-7 stroke-[1.5]"/>
          </div>
          <h2 className="text-xl font-medium text-[#0B251A] tracking-widest mb-2 font-sans">
            巧鈺好飾 JADE Meet Metal
          </h2>
          <p className="text-xs text-stone-400 tracking-widest uppercase mb-8 font-light">
            CMS 後台管理系統
          </p>
          <p className="text-xs sm:text-sm text-stone-500 font-light tracking-widest leading-relaxed mb-8 max-w-[280px]">
            此頁面僅供系統管理員登入。如果您並非管理員，請勿嘗試登入。
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 hover:bg-[#0B251A] disabled:bg-stone-300 text-white text-xs tracking-[0.2em] font-light py-3.5 px-6 rounded-2xl transition-all shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin"/>
            ) : (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.997 0-.746-.08-1.32-.176-1.888H12.24z" />
              </svg>
            )}
            <span>使用 GOOGLE 帳號登入</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. 已登入但非管理員（role !== "admin"）：原地顯示 Access Denied 介面
  const isAdmin = (session.user as any)?.role === "admin";

  if (!isAdmin) {
    const handleLogout = async () => {
      setIsLoading(true);
      try {
        await signOut();
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 selection:bg-[#0B251A] selection:text-white">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200/60 p-8 sm:p-10 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 mb-6 shadow-inner animate-pulse">
            <ShieldX className="w-7 h-7 stroke-[1.5]"/>
          </div>
          <h2 className="text-xl font-medium text-red-950 tracking-widest mb-2 font-sans">
            存取遭拒 ACCESS DENIED
          </h2>
          <p className="text-xs text-red-400 tracking-widest uppercase mb-6 font-light">
            非管理員帳號
          </p>
          <div className="mb-6 px-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-stone-600 text-xs tracking-wider">
            <span>當前帳號：</span>
            <span className="font-mono text-stone-900 font-normal">{session.user.email}</span>
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-stone-200 text-stone-700 rounded">
              {(session.user as any)?.role || "general"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 font-light tracking-widest leading-relaxed mb-8 max-w-[320px]">
            您的帳號目前尚未具備管理員權限（role 為 admin 才能進入）。若您是系統管理員，請確認是否使用了正確的 Google 帳號，或聯絡管理員指派權限。
          </p>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs tracking-[0.2em] font-light py-3.5 px-6 rounded-2xl transition-all shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin"/>
            ) : (
              <LogOut className="w-4 h-4 stroke-[1.5]"/>
            )}
            <span>登出並切換帳號</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. 白名單管理員：直接渲染後台儀表板
  return <AdminDashboard/>;
}

