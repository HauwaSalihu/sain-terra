"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { BadgeCheck, ShieldAlert, Clock } from "lucide-react";
import SAIN from "../../../assets/sainlogo.png";
import { API_URL, money } from "@/lib/api";
import { demoApi, isDemo } from "@/lib/demo";
import { RECEIPT_SIGNATURES_REQUIRED } from "@/lib/roles";
import type { Verification } from "@/lib/types";

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");
const fmtTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Public page opened by scanning the QR code on a receipt or offer letter. */
export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<Verification | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = isDemo()
      ? demoApi<Verification>(`/verify/${token}`)
      : fetch(`${API_URL}/verify/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body.message || "No document matches this code.");
          return body as Verification;
        });
    load.then(setResult).catch((e) => setError(e.message));
  }, [token]);

  const genuine =
    result && (result.kind === "receipt" ? result.status === "CONFIRMED" : ["ACTIVE", "COMPLETED"].includes(result.status));
  const tone = error ? "red" : !result ? "slate" : genuine ? "green" : "amber";
  const banner = {
    red: { cls: "border-red-200 bg-red-50 text-red-800", Icon: ShieldAlert, title: "Not a genuine document", text: error || "No record matches this code. Do not accept this document." },
    green: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: BadgeCheck, title: result?.kind === "offer" ? "Genuine offer letter" : "Genuine receipt", text: "This document matches Sain Terra's records. Check that the details below match the paper copy exactly." },
    amber: {
      cls: "border-amber-200 bg-amber-50 text-amber-800", Icon: Clock,
      title: result?.kind === "offer" ? "Offer not yet approved" : result?.status === "REVERSED" ? "Receipt reversed" : "Receipt not yet official",
      text: result?.kind === "offer"
        ? "This offer letter is still a draft. It is only valid once approved and e-signed by the CEO or COO."
        : result?.status === "REVERSED"
          ? "This payment was reversed and the receipt is no longer valid."
          : "This payment is recorded but not yet signed by both the CEO and COO, so the receipt is provisional.",
    },
    slate: { cls: "border-slate-200 bg-white text-slate-600", Icon: Clock, title: "Checking…", text: "Looking up this document." },
  }[tone];

  const rows: [string, string | undefined][] = !result
    ? []
    : result.kind === "receipt"
      ? [
          ["Receipt no.", result.receiptNumber || "Not issued yet"],
          ["Date", fmt(result.paidAt)],
          ["Received from", result.subscriber],
          ["For", [result.unit, result.property, result.location].filter(Boolean).join(", ")],
          ["Amount", money(result.amount)],
          ["Method", result.method.replaceAll("_", " ")],
          ...(result.total !== undefined ? [["Total price", money(result.total)] as [string, string]] : []),
          ...(result.paidToDate !== undefined ? [["Total paid to date", money(result.paidToDate)] as [string, string]] : []),
          ...(result.balance !== undefined ? [["Balance", result.balance === 0 ? "Fully paid" : money(result.balance)] as [string, string]] : []),
        ]
      : [
          ["Offer no.", result.offerNumber],
          ["Date", fmt(result.createdAt)],
          ["Subscriber", result.subscriber],
          ["Property", [result.unit, result.property, result.location].filter(Boolean).join(", ")],
          ["Offer price", money(result.agreedPrice)],
          ["Payment plan", result.paymentPlan === "FULL" ? "Outright" : "Instalments"],
        ];
  const signers = !result ? [] : result.kind === "receipt" ? result.signedBy : result.approvedBy ? [result.approvedBy] : [];

  return (
    <main className="min-h-screen bg-[#f8f9f7] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center"><Image src={SAIN} alt="Sain Terra" className="h-auto w-48" priority /></div>
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#286343]">Document verification</p>

        <div className={`mt-6 flex gap-3 rounded-2xl border p-5 ${banner.cls}`}>
          <banner.Icon className="shrink-0" size={26} />
          <div>
            <h1 className="font-semibold">{banner.title}</h1>
            <p className="mt-1 text-sm leading-6 opacity-90">{banner.text}</p>
          </div>
        </div>

        {result && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 px-5 py-3 text-sm last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="text-right font-semibold text-slate-800">{v || "—"}</span>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold">
              {result.kind === "receipt" ? `E-signatures (${signers.length} of ${result.signaturesRequired || RECEIPT_SIGNATURES_REQUIRED})` : "Approved by"}
            </h2>
            {signers.length ? (
              <ul className="mt-3 space-y-2">
                {signers.map((s) => (
                  <li key={s.signedAt + s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2"><BadgeCheck size={16} className="text-emerald-600" /><b>{s.name}</b>{s.title && <span className="text-slate-500">- {s.title}</span>}</span>
                    <span className="text-xs text-slate-400">{fmtTime(s.signedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Not signed yet.</p>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-slate-400">
          Only trust this page when it opens on Sain Terra&apos;s own web address. If anything differs from your paper copy, contact Sain Terra before relying on it.
        </p>
      </div>
    </main>
  );
}
