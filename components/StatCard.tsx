import type { LucideIcon } from "lucide-react";
export default function StatCard({ label, value, hint, icon: Icon, tone = "green" }: { label: string; value: string; hint: string; icon: LucideIcon; tone?: "green" | "gold" | "blue" | "violet" }) {
  const tones = { green: "bg-[#e6f0e8] text-[#215c3c]", gold: "bg-[#f7efdc] text-[#916b22]", blue: "bg-[#e6edf8] text-[#3f659b]", violet: "bg-[#eee8f8] text-[#7656a8]" };
  return <div className="rounded-2xl border border-[#e8ebe6] bg-white p-5 shadow-[0_2px_8px_rgba(20,40,25,.02)] transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon size={19}/></span></div>
    <p className="mt-5 text-2xl font-semibold tracking-tight text-[#1a2d22] sm:text-[28px]">{value}</p>
    <p className="mt-2 text-xs text-slate-400">{hint}</p>
  </div>;
}
