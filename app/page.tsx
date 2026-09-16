import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminDashboard from "./AdminDashboard";

export default async function AdminCmsPage() {
  const session = await auth();

  // If not logged in, redirect to login
  if (!session || !session.user) {
    redirect("/login");
  }

  // 嚴格身份驗證：僅限特定 Email 的 Google 帳號進入，其餘一律導回 unauthorized 頁面
  const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
  if (!session.user.email || !adminEmails.includes(session.user.email)) {
    redirect("/unauthorized");
  }

  return <AdminDashboard />;
}

