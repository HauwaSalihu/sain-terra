"use client";
import { useEffect, useState } from "react";
import { Building2, Wallet, BadgeCheck, CircleDollarSign, ArrowUpRight, Plus, ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import Reveal from "@/components/Reveal";
import { api, money } from "@/lib/api";
import { LOCATIONS } from "@/lib/locations";
import type { Property } from "@/lib/types";

type Dashboard = { properties: number; units: number; available: number; sold: number; collected: number; outstanding: number; recentProperties: Property[] };
const fallback: Dashboard = { properties: 0, units: 0, available: 0, sold: 0, collected: 0, outstanding: 0, recentProperties: [] };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard>(fallback);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  useEffect(() => {
    api<Dashboard>("/dashboard").then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
    api<Property[]>("/properties").then(setProperties).catch(() => {});
  }, []);
  const byLocation = LOCATIONS.map(location => {
    const here = properties.filter(p => p.location === location);
    const units = here.flatMap(p => p.units);
    return { location, properties: here.length, units: units.length, available: units.filter(u => u.status === "AVAILABLE").length, sold: units.filter(u => u.status === "SOLD").length };
  });
  return <AppShell title="Overview" subtitle="A clear view of Sainterra's property portfolio and financial performance.">
    <Reveal>
      <div className="mb-7 flex flex-col justify-between gap-4 rounded-3xl bg-[#173f2d] p-6 text-white sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b7d3bd]">Portfolio intelligence</p><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Every property. Every payment. One view.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/65">Manage your inventory, buyer allocations, offers and payments from one connected workspace.</p></div>
        <Link href="/properties" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#173f2d] transition hover:bg-[#e9f0e9]"><Plus size={17}/> Add a property</Link>
        <div className="pointer-events-none absolute opacity-0" aria-hidden="true"/>
      </div>
    </Reveal>
    {error && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Could not load live data: {error}. Check that the API server is running.</div>}
    {loading && <p className="mb-4 text-sm text-slate-400">Loading portfolio metrics…</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Properties" value={String(data.properties)} hint="Registered developments" icon={Building2}/>
      <StatCard label="Units available" value={String(data.available)} hint={`${data.units} total units tracked`} icon={BadgeCheck} tone="blue"/>
      <StatCard label="Payments collected" value={money(data.collected)} hint="Confirmed payment records" icon={Wallet} tone="gold"/>
      <StatCard label="Outstanding balance" value={money(data.outstanding)} hint="Across active offers" icon={CircleDollarSign} tone="violet"/>
    </div>
    <section className="mt-8 rounded-2xl border border-[#e8ebe6] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Availability by location</h3><p className="mt-1 text-xs text-slate-400">Units across all six locations</p></div><Link href="/properties" className="flex items-center gap-1 text-sm font-semibold text-[#286343]">Manage <ArrowRight size={15}/></Link></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {byLocation.map(l => <div key={l.location} className="rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-sm font-semibold"><MapPin size={14} className="text-[#286343]"/>{l.location}</p><span className="text-xs text-slate-400">{l.properties} {l.properties === 1 ? "property" : "properties"}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${l.units ? l.available/l.units*100 : 0}%`}}/></div>
          <p className="mt-2 text-xs text-slate-500"><b className="text-slate-800">{l.available}</b> available · {l.sold} sold · {l.units} units</p>
        </div>)}
      </div>
    </section>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_.8fr]">
      <section className="rounded-2xl border border-[#e8ebe6] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Property portfolio</h3><p className="mt-1 text-xs text-slate-400">Recently added properties</p></div><Link href="/properties" className="flex items-center gap-1 text-sm font-semibold text-[#286343]">View all <ArrowRight size={15}/></Link></div>
        {data.recentProperties.length ? <div className="mt-5 space-y-3">{data.recentProperties.slice(0,5).map(p => <div key={p._id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#edf2ed] text-[#286343]">{p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover"/> : <Building2 size={20}/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12}/>{p.location}</p></div>
          <span className="text-xs text-slate-500">{p.units?.length || 0} units</span>
        </div>)}</div> : <div className="mt-5 rounded-xl bg-[#f7f8f6] p-8 text-center"><Building2 className="mx-auto text-slate-300" size={28}/><p className="mt-3 text-sm font-medium">Your property register starts here</p><p className="mt-1 text-xs text-slate-400">Add your first property to populate the dashboard.</p><Link href="/properties" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#174b34] px-4 py-2.5 text-sm font-semibold text-white">Add property <ArrowUpRight size={15}/></Link></div>}
      </section>
      <section className="rounded-2xl border border-[#e8ebe6] bg-white p-5 sm:p-6">
        <h3 className="font-semibold">Portfolio snapshot</h3><p className="mt-1 text-xs text-slate-400">Unit allocation overview</p>
        <div className="mt-6 space-y-5">
          {[{label:"Available",n:data.available,color:"bg-emerald-600"},{label:"Sold",n:data.sold,color:"bg-[#b8954b]"},{label:"Other / reserved / rented",n:Math.max(0,data.units-data.available-data.sold),color:"bg-slate-400"}].map(item => <div key={item.label}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-500">{item.label}</span><span className="font-semibold">{item.n}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{width:`${data.units ? item.n/data.units*100 : 0}%`}}/></div></div>)}
        </div>
        <div className="mt-7 rounded-xl bg-[#f7f8f6] p-4"><p className="text-xs text-slate-500">Sales tracked</p><p className="mt-1 text-xl font-semibold">{data.sold} <span className="text-sm font-normal text-slate-400">units sold</span></p><Link href="/offers" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#286343]">Review offers <ArrowRight size={14}/></Link></div>
      </section>
    </div>
  </AppShell>;
}
