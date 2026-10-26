"use client";
import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, Plus, X, Check, Ban } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { ROLES, roleLabel } from "@/lib/roles";
import type { Role, User } from "@/lib/types";

const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]";
const idOf = (u: User) => u._id || u.id || u.email;

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "AGENT" as Role });

  async function load() {
    try {
      setUsers(await api<User[]>("/users"));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "AGENT" });
      setNotice("Staff account created. Share the temporary password privately.");
      load();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  async function update(u: User, patch: Partial<User>) {
    try {
      await api(`/users/${idOf(u)}`, { method: "PATCH", body: JSON.stringify(patch) });
      setNotice(`${u.name || u.email} updated.`);
      load();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  return (
    <AppShell title="Staff & access" subtitle="Only staff listed here can sign in. Each role sees only what it needs." permission="users.manage">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Staff accounts</h2>
          <p className="mt-1 text-sm text-slate-500">{users.filter((u) => u.active !== false).length} active accounts · no public sign-up</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">
          <Plus size={17} /> Add staff
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#edf4ed] p-3 text-sm text-[#245739]">
          {notice}
          <button onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.value} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold">{r.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{r.description}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#f7f8f6] text-[11px] uppercase tracking-wider text-slate-400">
            <tr>{["Name", "Email", "Role", "Status", ""].map((x) => <th key={x} className="px-5 py-4 font-semibold">{x}</th>)}</tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = me?.email === u.email;
              return (
                <tr key={idOf(u)} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-semibold">{u.name || "—"}{self && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</td>
                  <td className="px-5 py-4 text-slate-500">{u.email}</td>
                  <td className="px-5 py-4">
                    <select disabled={self} value={u.role || ""} onChange={(e) => update(u, { role: e.target.value as Role })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60">
                      {!u.role && <option value="">No role</option>}
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${u.active === false ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>{u.active === false ? "Disabled" : "Active"}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!self && (
                      <button onClick={() => update(u, { active: u.active === false })} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold">
                        {u.active === false ? <><Check size={13} /> Enable</> : <><Ban size={13} /> Disable</>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users.length && (
          <div className="p-12 text-center">
            <ShieldCheck className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 text-sm font-semibold">No staff accounts loaded</p>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-[#f8f9f7]">
            <div className="flex items-center justify-between border-b bg-white p-5">
              <h2 className="font-semibold">Add staff account</h2>
              <button onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              <label className="block text-xs text-slate-500">Full name *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Email *<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Temporary password *<input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} /></label>
              <label className="block text-xs text-slate-500">Role *
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={input}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-400">{ROLES.find((r) => r.value === form.role)?.description}</span>
              </label>
              <button className="w-full rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white">Create {roleLabel(form.role).toLowerCase()} account</button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
