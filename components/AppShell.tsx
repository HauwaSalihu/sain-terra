
"use client";

import { useEffect, useState } from "react";
import { Bell, Menu, LogOut, Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "../contexts/AuthContext";
import { roleLabel, type Permission } from "../lib/roles";

export default function AppShell({
  children,
  title,
  subtitle,
  permission,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Page is hidden from staff whose role lacks this permission. */
  permission?: Permission;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const { user, loading, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f9f7]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#dce6dc] border-t-[#174b34]" />
          <p className="mt-4 text-sm text-slate-500">
            {loading ? "Verifying your session..." : "Redirecting to login..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e7eae5] bg-[#f8f9f7]/90 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-lg p-2 hover:bg-white lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden text-xs text-slate-500 sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              aria-label="Notifications"
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500"
            >
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
            </button>

            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-semibold text-slate-800">
                {user.name || user.email}
              </p>
              <p className="text-xs text-slate-500">
                {roleLabel(user.role)}
              </p>
            </div>

            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#174b34] text-xs font-bold uppercase text-white">
              {(user.name || user.email).slice(0, 2)}
            </div>

            <button
              onClick={() => void logout()}
              aria-label="Log out"
              title="Log out"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-7 xl:p-10">
          {permission && !can(permission) ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <Lock className="mx-auto text-slate-300" size={34} />
              <h2 className="mt-4 font-semibold">You don&apos;t have access to this page</h2>
              <p className="mt-2 text-sm text-slate-500">
                Your role ({roleLabel(user.role)}) does not include this area. Ask an administrator if you need access.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
