"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Plus, Search, X, Phone, Mail, MapPin, Wallet, CircleDollarSign,
  FileText, Download, ReceiptText, Clock,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { api, money } from "@/lib/api";
import { printOfferLetter, printReceipt } from "@/lib/documents";
import { offerProperty, offerTotals, offerUnit, refId, subscriberRecord } from "@/lib/ledger";
import { LOCATIONS } from "@/lib/locations";
import type { Buyer, Offer, Payment, Property } from "@/lib/types";

const blank = { fullName: "", phone: "", email: "", address: "", occupation: "", nextOfKin: "", nextOfKinPhone: "" };
const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]";
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const statusTone: Record<string, string> = {
  "Fully paid": "bg-emerald-100 text-emerald-800",
  Paying: "bg-blue-100 text-blue-800",
  "Awaiting first payment": "bg-amber-100 text-amber-800",
  "No offer": "bg-slate-100 text-slate-600",
};

export default function SubscribersPage() {
  const { can } = useAuth();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Buyer | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(blank);

  async function load() {
    try {
      const [b, o, p, pr] = await Promise.all([
        api<Buyer[]>("/buyers"),
        api<Offer[]>("/offers"),
        api<Payment[]>("/payments").catch(() => [] as Payment[]),
        api<Property[]>("/properties"),
      ]);
      setBuyers(b); setOffers(o); setPayments(p); setProperties(pr);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/buyers", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm(blank);
      setNotice("Subscriber registered. Create an offer letter to allocate a unit.");
      load();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  const rows = useMemo(
    () => buyers.map((b) => ({ buyer: b, record: subscriberRecord(b, offers, payments) })),
    [buyers, offers, payments],
  );

  const visible = rows.filter(({ buyer, record }) => {
    const locations = record.offers.map((o) => offerProperty(o, properties)?.location);
    return (
      `${buyer.fullName} ${buyer.phone} ${buyer.email || ""}`.toLowerCase().includes(query.toLowerCase()) &&
      (location === "ALL" || locations.includes(location)) &&
      (status === "ALL" || record.status === status)
    );
  });

  const totals = visible.reduce(
    (s, { record }) => ({ offered: s.offered + record.offered, paid: s.paid + record.paid, balance: s.balance + record.balance }),
    { offered: 0, paid: 0, balance: 0 },
  );

  const selectedRecord = selected ? subscriberRecord(selected, offers, payments) : null;

  return (
    <AppShell title="Subscribers" subtitle="Every subscriber's offer, price, payment track record and unit availability.">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Subscriber register</h2>
          <p className="mt-1 text-sm text-slate-500">{buyers.length} registered subscribers</p>
        </div>
        {can("subscribers.manage") && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">
            <Plus size={17} /> Add subscriber
          </button>
        )}
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#edf4ed] p-3 text-sm text-[#245739]">
          {notice}
          <button onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subscribers" value={String(visible.length)} hint="Matching current filters" icon={Users} />
        <StatCard label="Price offered" value={money(totals.offered)} hint="Sum of agreed prices" icon={FileText} tone="blue" />
        <StatCard label="Paid" value={money(totals.paid)} hint="Confirmed payments" icon={Wallet} tone="gold" />
        <StatCard label="Outstanding" value={money(totals.balance)} hint="Still to be collected" icon={CircleDollarSign} tone="violet" />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search size={17} className="text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone or email…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
          <option value="ALL">All locations</option>
          {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
          <option value="ALL">All statuses</option>
          {Object.keys(statusTone).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f7f8f6] text-[11px] uppercase tracking-wider text-slate-400">
            <tr>{["Subscriber", "Property / unit", "Price offered", "Paid", "Balance", "Payments", "Status"].map((x) => <th key={x} className="px-5 py-4 font-semibold">{x}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map(({ buyer: b, record: r }) => {
              const first = r.offers[0];
              const prop = first && offerProperty(first, properties);
              const unit = first && offerUnit(first, properties);
              return (
                <tr key={b._id} onClick={() => setSelected(b)} className="cursor-pointer border-t border-slate-100 hover:bg-[#f8faf8]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7f0e8] text-sm font-bold text-[#245739]">
                        {b.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-semibold">{b.fullName}</p>
                        <p className="text-xs text-slate-400">{b.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {prop ? <><p>{prop.name}</p><p className="mt-1 text-xs text-slate-400">{prop.location} · {unit?.unitNumber || "Unit"}{r.offers.length > 1 ? ` +${r.offers.length - 1} more` : ""}</p></> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4 font-medium">{money(r.offered)}</td>
                  <td className="px-5 py-4">
                    {money(r.paid)}
                    <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${r.progress}%` }} /></div>
                  </td>
                  <td className="px-5 py-4 font-medium">{money(r.balance)}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {r.confirmedCount} confirmed{r.pendingCount ? ` · ${r.pendingCount} pending` : ""}
                    <p className="mt-1">Last: {fmtDate(r.lastPayment?.paidAt)}</p>
                  </td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${statusTone[r.status]}`}>{r.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && (
          <div className="p-12 text-center">
            <Users className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 text-sm font-semibold">No subscribers found</p>
            <p className="mt-1 text-xs text-slate-400">Register a subscriber, then create an offer letter to allocate a unit.</p>
          </div>
        )}
      </div>

      {selected && selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#f8f9f7]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
              <div>
                <h2 className="font-semibold">{selected.fullName}</h2>
                <p className="mt-1 text-xs text-slate-400">Subscriber track record</p>
              </div>
              <button onClick={() => setSelected(null)}><X size={19} /></button>
            </div>
            <div className="space-y-5 p-5">
              <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2 text-slate-600"><Phone size={14} />{selected.phone}</p>
                <p className="flex items-center gap-2 break-all text-slate-600"><Mail size={14} />{selected.email || "—"}</p>
                <p className="flex items-center gap-2 text-slate-600 sm:col-span-2"><MapPin size={14} />{selected.address || "No address"}</p>
                {selected.occupation && <p className="text-slate-600">Occupation: {selected.occupation}</p>}
                {selected.nextOfKin && <p className="text-slate-600">Next of kin: {selected.nextOfKin} {selected.nextOfKinPhone && `(${selected.nextOfKinPhone})`}</p>}
              </section>

              <section className="grid grid-cols-3 gap-3">
                {[["Price offered", selectedRecord.offered], ["Paid", selectedRecord.paid], ["Balance", selectedRecord.balance]].map(([label, v]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-1 font-semibold">{money(v as number)}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Offers &amp; unit availability</h3>
                  {can("offers.create") && <Link href={`/offers?buyer=${selected._id}`} className="text-xs font-semibold text-[#286343]">+ New offer</Link>}
                </div>
                {selectedRecord.offers.length ? selectedRecord.offers.map((o) => {
                  const prop = offerProperty(o, properties);
                  const unit = offerUnit(o, properties);
                  const t = offerTotals(o, payments);
                  return (
                    <div key={o._id} className="mb-3 rounded-xl border border-slate-100 p-4 last:mb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{prop?.name || "Property"} · {unit?.unitNumber || "Unit"}</p>
                          <p className="mt-1 text-xs text-slate-400">{prop?.location} · {unit?.type} · {o.paymentPlan === "FULL" ? "Outright" : "Instalments"} · Offered {fmtDate(o.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs ${unit?.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" : unit?.status === "SOLD" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>Unit: {unit?.status || "—"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-slate-400">Price</p><p className="font-semibold">{money(t.total)}</p></div>
                        <div><p className="text-slate-400">Paid</p><p className="font-semibold">{money(t.paid)}</p></div>
                        <div><p className="text-slate-400">Balance</p><p className="font-semibold">{t.fullyPaid ? "Fully paid" : money(t.balance)}</p></div>
                      </div>
                      <button onClick={() => printOfferLetter({ offer: o, buyer: selected, property: prop, unit })} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                        <Download size={13} /> Offer letter
                      </button>
                    </div>
                  );
                }) : <p className="text-sm text-slate-400">No offer has been issued yet.</p>}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold">Payment history</h3>
                {selectedRecord.history.length ? (
                  <ol className="space-y-3">
                    {selectedRecord.history.map((p) => {
                      const offer = offers.find((o) => o._id === refId(p.offer));
                      const data = { payment: p, offer, buyer: selected, property: offer && offerProperty(offer, properties), unit: offer && offerUnit(offer, properties), payments };
                      return (
                        <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8f9f7] p-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-8 w-8 place-items-center rounded-full ${p.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : p.status === "REVERSED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {p.status === "CONFIRMED" ? <ReceiptText size={15} /> : <Clock size={15} />}
                            </span>
                            <div>
                              <p className="font-semibold">{money(p.amount)}</p>
                              <p className="text-xs text-slate-400">{fmtDate(p.paidAt)} · {p.method.replaceAll("_", " ")} · {p.status}</p>
                            </div>
                          </div>
                          {can("receipts.issue") && (
                            <div className="flex gap-2">
                              <button onClick={() => printReceipt("official", data)} className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold">A4 receipt</button>
                              <button onClick={() => printReceipt("compact", data)} className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold">Slip</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="text-sm text-slate-400">No payments recorded yet.</p>}
              </section>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-[#f8f9f7]">
            <div className="flex items-center justify-between border-b bg-white p-5">
              <h2 className="font-semibold">Add subscriber</h2>
              <button onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              <label className="block text-xs text-slate-500">Full name *<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Phone *<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Occupation<input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} className={input} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-500">Next of kin<input value={form.nextOfKin} onChange={(e) => setForm({ ...form, nextOfKin: e.target.value })} className={input} /></label>
                <label className="block text-xs text-slate-500">Next of kin phone<input value={form.nextOfKinPhone} onChange={(e) => setForm({ ...form, nextOfKinPhone: e.target.value })} className={input} /></label>
              </div>
              <button className="w-full rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">Save subscriber</button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
