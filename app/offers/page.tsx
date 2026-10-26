"use client";
import { FormEvent, useEffect, useState } from "react";
import { FileText, Plus, X, Download, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api, money } from "@/lib/api";
import { printOfferLetter } from "@/lib/documents";
import { amountInWords, offerBuyer, offerProperty, offerTotals, offerUnit } from "@/lib/ledger";
import { LOCATIONS } from "@/lib/locations";
import type { Buyer, Offer, Payment, PaymentPlan, Property } from "@/lib/types";

const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]";
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const blank = {
  buyer: "", location: "", property: "", unit: "", agreedPrice: "", paymentPlan: "INSTALLMENTS" as PaymentPlan,
  initialDeposit: "", installmentMonths: "12", validUntil: inDays(14), specialTerms: "", notes: "",
  signatory: "", signatoryTitle: "", printAfterSave: true,
};

export default function OffersPage() {
  const { user, can } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blank);

  async function load() {
    try {
      const [o, b, p, pay] = await Promise.all([
        api<Offer[]>("/offers"),
        api<Buyer[]>("/buyers"),
        api<Property[]>("/properties"),
        api<Payment[]>("/payments").catch(() => [] as Payment[]),
      ]);
      setOffers(o); setBuyers(b); setProperties(p); setPayments(pay);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // Deep links from the subscriber and property screens pre-fill the form.
    const params = new URLSearchParams(window.location.search);
    const buyer = params.get("buyer") || "";
    const property = params.get("property") || "";
    if (buyer || property) {
      setForm((f) => ({ ...f, buyer, property }));
      setOpen(true);
    }
  }, []);

  function openForm() {
    setForm((f) => ({ ...blank, buyer: f.buyer, property: f.property, signatory: user?.name || "", validUntil: inDays(14) }));
    setOpen(true);
  }

  const chosen = properties.find((p) => p._id === form.property);
  const propertyChoices = properties.filter((p) => !form.location || p.location === form.location);
  const price = Number(form.agreedPrice) || 0;
  const deposit = Number(form.initialDeposit) || 0;
  const months = Number(form.installmentMonths) || 0;
  const monthly = form.paymentPlan === "INSTALLMENTS" && months ? Math.ceil(Math.max(0, price - deposit) / months) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.paymentPlan === "INSTALLMENTS" && deposit > price) {
      setNotice("The initial deposit cannot be more than the offer price.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        buyer: form.buyer, property: form.property, unit: form.unit,
        agreedPrice: price, paymentPlan: form.paymentPlan,
        initialDeposit: form.paymentPlan === "FULL" ? price : deposit,
        installmentMonths: form.paymentPlan === "FULL" ? 0 : months,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
        specialTerms: form.specialTerms, notes: form.notes,
      };
      const created = await api<Offer>("/offers", { method: "POST", body: JSON.stringify(payload) });
      if (form.printAfterSave && created?._id) {
        printOfferLetter({
          offer: { ...payload, ...created },
          buyer: buyers.find((b) => b._id === form.buyer),
          property: chosen,
          unit: chosen?.units.find((u) => u._id === form.unit),
          signatory: form.signatory,
          signatoryTitle: form.signatoryTitle,
        });
      }
      setOpen(false);
      setForm(blank);
      setNotice("Offer created, unit reserved and offer letter generated.");
      load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visible = offers.filter((o) => {
    const b = offerBuyer(o, buyers);
    const p = offerProperty(o, properties);
    return `${b?.fullName || ""} ${p?.name || ""} ${p?.location || ""} ${o.status} ${o._id}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <AppShell title="Offer letters" subtitle="Allocate a unit to a subscriber and generate the offer letter automatically.">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Offer register</h2>
          <p className="mt-1 text-sm text-slate-500">{offers.length} offers issued</p>
        </div>
        {can("offers.create") && (
          <button onClick={openForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">
            <Plus size={17} /> New offer letter
          </button>
        )}
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#edf4ed] p-3 text-sm text-[#245739]">
          {notice}
          <button onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Search size={17} className="text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by subscriber, property, location or status…" className="w-full bg-transparent text-sm outline-none" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#f7f8f6] text-[11px] uppercase tracking-wider text-slate-400">
            <tr>{["Subscriber / offer", "Property & unit", "Price offered", "Paid", "Balance", "Status", "Document"].map((x) => <th key={x} className="px-5 py-4 font-semibold">{x}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const b = offerBuyer(o, buyers);
              const p = offerProperty(o, properties);
              const u = offerUnit(o, properties);
              const t = offerTotals(o, payments);
              return (
                <tr key={o._id} className="border-t border-slate-100">
                  <td className="px-5 py-4"><p className="font-semibold">{b?.fullName || "Subscriber"}</p><p className="mt-1 text-xs text-slate-400">{o.offerNumber || o._id.slice(-8).toUpperCase()}</p></td>
                  <td className="px-5 py-4"><p>{p?.name || "Property"}</p><p className="mt-1 text-xs text-slate-400">{p?.location} · {u?.unitNumber || "Unit"}</p></td>
                  <td className="px-5 py-4 font-medium">{money(t.total)}</td>
                  <td className="px-5 py-4">{money(t.paid)}</td>
                  <td className="px-5 py-4 font-medium">{t.fullyPaid ? <span className="text-emerald-700">Fully paid</span> : money(t.balance)}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-[#e9f2e9] px-2.5 py-1 text-xs text-[#245739]">{o.status}</span></td>
                  <td className="px-5 py-4">
                    <button onClick={() => printOfferLetter({ offer: o, buyer: b, property: p, unit: u, signatory: user?.name })} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                      <Download size={14} /> Offer letter
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 text-sm font-semibold">No offers yet</p>
            <p className="mt-1 text-xs text-slate-400">Create an offer after adding at least one subscriber and property.</p>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#f8f9f7]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
              <div>
                <h2 className="font-semibold">Offer letter form</h2>
                <p className="mt-1 text-xs text-slate-400">Fill this once; the offer letter is generated from it.</p>
              </div>
              <button onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <form onSubmit={submit} className="space-y-5 p-5">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold">1. Subscriber &amp; unit</h3>
                <label className="block text-xs text-slate-500">Subscriber *
                  <select required value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} className={input}>
                    <option value="">Select subscriber</option>
                    {buyers.map((b) => <option key={b._id} value={b._id}>{b.fullName} · {b.phone}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-slate-500">Location
                    <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value, property: "", unit: "", agreedPrice: "" })} className={input}>
                      <option value="">All locations</option>
                      {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-500">Property *
                    <select required value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value, unit: "", agreedPrice: "" })} className={input}>
                      <option value="">Select property</option>
                      {propertyChoices.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.location}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-slate-500">Available unit *
                  <select required value={form.unit} onChange={(e) => { const u = chosen?.units.find((x) => x._id === e.target.value); setForm({ ...form, unit: e.target.value, agreedPrice: u ? String(u.price) : form.agreedPrice }); }} className={input}>
                    <option value="">{chosen && !chosen.units.some((u) => u.status === "AVAILABLE") ? "No available units in this property" : "Select unit"}</option>
                    {chosen?.units.filter((u) => u.status === "AVAILABLE").map((u) => <option key={u._id} value={u._id}>{u.unitNumber} · {u.type} · {money(u.price)}</option>)}
                  </select>
                </label>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold">2. Price &amp; payment plan</h3>
                <label className="block text-xs text-slate-500">Offer price (NGN) *
                  <input required type="number" min="1" value={form.agreedPrice} onChange={(e) => setForm({ ...form, agreedPrice: e.target.value })} className={input} />
                  {price > 0 && <span className="mt-1 block text-[11px] text-slate-400">{amountInWords(price)}</span>}
                </label>
                <label className="block text-xs text-slate-500">Payment plan
                  <select value={form.paymentPlan} onChange={(e) => setForm({ ...form, paymentPlan: e.target.value as PaymentPlan })} className={input}>
                    <option value="INSTALLMENTS">Instalments</option>
                    <option value="FULL">Outright (full payment)</option>
                  </select>
                </label>
                {form.paymentPlan === "INSTALLMENTS" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-slate-500">Initial deposit (NGN) *
                      <input required type="number" min="0" max={price || undefined} value={form.initialDeposit} onChange={(e) => setForm({ ...form, initialDeposit: e.target.value })} className={input} />
                    </label>
                    <label className="block text-xs text-slate-500">Spread balance over (months) *
                      <input required type="number" min="1" max="120" value={form.installmentMonths} onChange={(e) => setForm({ ...form, installmentMonths: e.target.value })} className={input} />
                    </label>
                  </div>
                )}
                {price > 0 && (
                  <div className="rounded-xl bg-[#f7f8f6] p-4 text-xs text-slate-600">
                    {form.paymentPlan === "FULL"
                      ? <>Subscriber pays <b>{money(price)}</b> outright.</>
                      : <>Deposit <b>{money(deposit)}</b>, balance <b>{money(Math.max(0, price - deposit))}</b>{months ? <> over {months} months ≈ <b>{money(monthly)}</b>/month</> : null}.</>}
                  </div>
                )}
                <label className="block text-xs text-slate-500">Offer valid until
                  <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={input} />
                </label>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold">3. Letter details</h3>
                <label className="block text-xs text-slate-500">Special terms (printed on the letter)
                  <textarea rows={3} value={form.specialTerms} onChange={(e) => setForm({ ...form, specialTerms: e.target.value })} className={input} placeholder="e.g. Price includes infrastructure levy." />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-slate-500">Signatory name<input value={form.signatory} onChange={(e) => setForm({ ...form, signatory: e.target.value })} className={input} /></label>
                  <label className="block text-xs text-slate-500">Signatory title<input value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} className={input} placeholder="e.g. Managing Director" /></label>
                </div>
                <label className="block text-xs text-slate-500">Internal notes (not printed)
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.printAfterSave} onChange={(e) => setForm({ ...form, printAfterSave: e.target.checked })} />
                  Open the offer letter for printing / PDF after saving
                </label>
              </section>

              <button disabled={busy} className="w-full rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Saving…" : "Create offer & generate letter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
