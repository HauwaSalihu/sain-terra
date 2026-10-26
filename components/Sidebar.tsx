
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Users,
  ReceiptText,
  FileText,
  X,
  Sprout,
} from "lucide-react";
import Image from "next/image";
import SAIN from "../assets/sainlogo.png"

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/properties", label: "Properties & units", icon: Building2 },
  // { href: "/buyers", label: "Buyers", icon: Users },
  // { href: "/offers", label: "Offers", icon: FileText },
  // { href: "/payments", label: "Payments & receipts", icon: ReceiptText },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close navigation overlay"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#e5e9e4] bg-white px-5 py-6 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* TOP: Logo and brand name */}
        <div className="">
          <Link
            href="/"
            className="flex items-center gap-3 mb-4"
            onClick={onClose}
          >
            <Image
              src={SAIN}
              alt="Sainterra logo"  
            />
          </Link>

          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* MIDDLE: Navigation links */}
        <nav className="flex flex-1 flex-col  gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#eaf2ec] text-[#174b34]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM: Admin portal */}
        <div className="mt-auto flex shrink-0 items-center gap-3 border-t border-slate-100 pt-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dfe9df] text-sm font-bold text-[#174b34]">
            AD
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Admin Portal
            </p>
            <p className="text-xs text-slate-400">
              Internal workspace
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
