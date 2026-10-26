"use client";
import { FormEvent, useEffect, useState } from "react";
import { ReceiptText, Plus, X, Search, FileText, Printer } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api, money } from "@/lib/api";
import { printReceipt, type ReceiptFormat } from "@/lib/documents";
import { amountInWords, offerBuyer, offerProperty, offerTotals, offerUnit, receiptPosition } from "@/lib/ledger";
import type { Buyer, Offer, Payment, Property } from "@/lib/types";

const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]";
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentsPage() {
  const { user, can } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<ReceiptFormat>("official");
  const [form, setForm] = useState({ offer: "", amount: "", method: "BANK_TRANSFER", reference: "", paidAt: today(), receivedBy: "", note: "" });

  async function load() {
    try {
      const [p, o, b, pr] = await Promise.all([
        api<Payment[]>("/payments"),
        api<Offer[]>("/offers"),
        api<Buyer[]>("/buyers"),
        api<Property[]>("/properties"),
      ]);
      setPayments(p); setOffers(o); setBuyers(b); setProperties(pr);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []);

  const offerOf = (p: Payment) => (typeof p.offer === "object" ? p.offer : offers.find((o) => o._id === p.offer));
  const selectedOffer = offers.find((o) => o._id === form.offer);
  const selectedTotals = selectedOffer && offerTotals(selectedOffer, payments);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (selectedTotals && amount > selectedTotals.balance) {
      setNotice(`Amount is more than the outstanding balance of ${money(selectedTotals.balance)}.`);
      return;
    }
    try {
      await api("/payments", { method: "POST", body: JSON.stringify({ ...form, amount, paidAt: new Date(form.paidAt).toISOString() }) });
      setOpen(false);
      setForm({ offer: "", amount: "", method: "BANK_TRANSFER", reference: "", paidAt: today(), receivedBy: "", note: "" });
      setNotice(can("payments.confirm")
        ? "Payment recorded. Confirm it after reconciling against the company account."
        : "Payment recorded as pending. Accounts will confirm it after reconciliation.");
      load();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  async function confirm(id: string) {
    try {
      await api(`/payments/${id}/confirm`, { method: "PATCH" });
      setNotice("Payment confirmed. The receipt is now official.");
      load();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  function receipt(p: Payment, f: ReceiptFormat) {
    const offer = offerOf(p);
    printReceipt(f, {
      payment: p, offer, payments,
      buyer: offer && offerBuyer(offer, buyers),
      property: offer && offerProperty(offer, properties),
      unit: offer && offerUnit(offer, properties),
    });
  }

  const visible = payments.filter((p) => {
    const offer = offerOf(p);
    const name = offer ? offerBuyer(offer, buyers)?.fullName : "";
    return `${p.reference} ${p.receiptNumber || ""} ${p.status} ${p.method} ${name}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <AppShell title="Payments & receipts" subtitle="Record payments, reconcile funds and issue a digital receipt for each transaction." permission="payments.view">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Payment register</h2>
          <p className="mt-1 text-sm text-slate-500">{payments.length} payment records</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {can("receipts.issue") && (
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-semibold">
              {([["official", "A4 official", FileText], ["compact", "Compact slip", Printer]] as const).map(([value, label, Icon]) => (
                <button key={value} onClick={() => setFormat(value)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 ${format === value ? "bg-[#174b34] text-white" : "text-slate-600"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          )}
          {can("payments.record") && (
            <button onClick={() => { setForm((f) => ({ ...f, receivedBy: user?.name || "" })); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">
              <Plus size={17} /> Record payment
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#edf4ed] p-3 text-sm text-[#245739]">
          {notice}
          <button onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Search size={17} className="text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by subscriber, reference, receipt or status…" className="w-full bg-transparent text-sm outline-none" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-[#f7f8f6] text-[11px] uppercase tracking-wider text-slate-400">
            <tr>{["Date", "Subscriber / property", "Amount", "Paid of total", "Method / ref", "Status", "Receipt", "Action"].map((x) => <th key={x} className="px-5 py-4 font-semibold">{x}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const offer = offerOf(p);
              const pos = receiptPosition(p, offer, payments);
              const prop = offer && offerProperty(offer, properties);
              return (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="px-5 py-4">{new Date(p.paidAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-5 py-4"><p className="font-medium">{(offer && offerBuyer(offer, buyers)?.fullName) || "—"}</p><p className="mt-1 text-xs text-slate-400">{prop ? `${prop.name} · ${prop.location}` : ""}</p></td>
                  <td className="px-5 py-4 font-semibold">{money(p.amount)}</td>
                  <td className="px-5 py-4 text-xs">
                    {pos.known ? (pos.fullyPaid ? <span className="font-semibold text-emerald-700">Paid in full · {money(pos.total)}</span> : <>{money(pos.paidToDate)} of {money(pos.total)}<p className="mt-1 text-slate-400">Balance {money(pos.balance)}</p></>) : "—"}
                  </td>
                  <td className="px-5 py-4">{p.method.replaceAll("_", " ")}<p className="mt-1 text-xs text-slate-400">{p.reference || "—"}</p></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${p.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : p.status === "REVERSED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{p.status}</span></td>
                  <td className="px-5 py-4 text-xs">{p.receiptNumber || "Not issued"}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {p.status === "PENDING" && can("payments.confirm") && <button onClick={() => confirm(p._id)} className="rounded-lg bg-[#174b34] px-3 py-2 text-xs font-semibold text-white">Confirm</button>}
                      {can("receipts.issue") && (
                        <button onClick={() => receipt(p, format)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold" title={format === "official" ? "A4 official receipt" : "Compact slip receipt"}>
                          <ReceiptText size={13} /> Receipt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && (
          <div className="p-12 text-center">
            <ReceiptText className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 text-sm font-semibold">No payments found</p>
            <p className="mt-1 text-xs text-slate-400">Record a payment against an offer.</p>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-[#f8f9f7]">
            <div className="flex items-center justify-between border-b bg-white p-5">
              <div>
                <h2 className="font-semibold">Record payment</h2>
                <p className="mt-1 text-xs text-slate-400">Pending payments do not affect confirmed balances.</p>
              </div>
              <button onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              <label className="block text-xs text-slate-500">Offer *
                <select required value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value, amount: "" })} className={input}>
                  <option value="">Select offer</option>
                  {offers.filter((o) => !offerTotals(o, payments).fullyPaid).map((o) => (
                    <option key={o._id} value={o._id}>
                      {offerBuyer(o, buyers)?.fullName || "Subscriber"} · {offerProperty(o, properties)?.name || "Property"} · balance {money(offerTotals(o, payments).balance)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTotals && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-4 text-xs">
                  <div><p className="text-slate-400">Total</p><p className="font-semibold">{money(selectedTotals.total)}</p></div>
                  <div><p className="text-slate-400">Paid</p><p className="font-semibold">{money(selectedTotals.paid)}</p></div>
                  <div><p className="text-slate-400">Balance</p><p className="font-semibold">{money(selectedTotals.balance)}</p></div>
                </div>
              )}
              <label className="block text-xs text-slate-500">
                <span className="flex items-center justify-between">Amount (NGN) *
                  {selectedTotals && <button type="button" onClick={() => setForm({ ...form, amount: String(selectedTotals.balance) })} className="font-semibold text-[#286343]">Pay full balance</button>}
                </span>
                <input required type="number" min="1" max={selectedTotals?.balance || undefined} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input} />
                {Number(form.amount) > 0 && <span className="mt-1 block text-[11px] text-slate-400">{amountInWords(Number(form.amount))}</span>}
              </label>
              <label className="block text-xs text-slate-500">Payment method
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={input}>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="POS">POS</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="block text-xs text-slate-500">Transaction reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Payment date<input required type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Received by<input value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Note<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={input} /></label>
              <button className="w-full rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">Save pending payment</button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
