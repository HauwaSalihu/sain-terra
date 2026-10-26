"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Building2,
  MapPin,
  X,
  ImagePlus,
  Trash2,
  UserPlus,
  Eye,
  Pencil,
  ExternalLink,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Reveal from "@/components/Reveal";
import { api, money } from "@/lib/api";
import type { Property } from "@/lib/types";

const locations = [
  "Jahi",
  "Gudu",
  "Katampe I",
  "Katampe II",
  "Gaduwa",
  "Guzape",
];
const blankUnit = {
  unitNumber: "Unit 01",
  type: "Flat",
  price: "",
  bedrooms: "3",
  bathrooms: "3",
  description: "",
};
export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    location: "Jahi",
    propertyType: "Block of flats",
    description: "",
    images: "",
    units: [{ ...blankUnit }],
  });
  const router = useRouter();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  async function load() {
    try {
      setProperties(await api<Property[]>("/properties"));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function setField(key: string, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  function updateUnit(index: number, key: string, value: string) {
    setForm((old) => ({
      ...old,
      units: old.units.map((u, i) =>
        i === index ? { ...u, [key]: value } : u,
      ),
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const payload = {
        ...form,
        images: form.images
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        units: form.units.map((u) => ({
          ...u,
          price: Number(u.price),
          bedrooms: Number(u.bedrooms),
          bathrooms: Number(u.bathrooms),
        })),
      };
      await api("/properties", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice("Property created successfully.");
      setShowForm(false);
      setForm({
        name: "",
        location: "Jahi",
        propertyType: "Block of flats",
        description: "",
        images: "",
        units: [{ ...blankUnit }],
      });
      await load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = properties.filter((p) =>
    `${p.name} ${p.location} ${p.propertyType}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <AppShell
      title="Properties & units"
      subtitle="Manage developments, inventory, unit pricing and availability."
    >
      <Reveal>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">Property register</h2>
            <p className="mt-1 text-sm text-slate-500">
              {properties.length} properties registered
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white hover:bg-[#205d40]"
          >
            <Plus size={17} /> Add property
          </button>
        </div>
        {notice && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-[#dce8dc] bg-[#f0f6ef] p-3 text-sm text-[#245739]">
            {notice}
            <button onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search size={17} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property, location or type…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        {visible.length ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((p) => {
              const total = p.units.reduce((s, u) => s + u.price, 0);
              return (
                <article
                  key={p._id}
                  onClick={() => setSelectedProperty(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedProperty(p);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Actions for ${p.name}`}
                  className="cursor-pointer overflow-hidden rounded-2xl border border-[#e6eae5] bg-white transition hover:-translate-y-1 hover:border-[#174b34]/30 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#174b34]"
                >
                  <div className="relative h-44 bg-gradient-to-br from-[#dce8dd] via-[#eef1e9] to-[#c9d9cb]">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[#8aa18c]">
                        <Building2 size={42} strokeWidth={1.2} />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#245739]">
                      {p.propertyType}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin size={12} />
                          {p.location}
                        </p>
                      </div>
                      <span className="rounded-lg bg-[#f0f5f0] px-2.5 py-1.5 text-xs font-semibold text-[#245739]">
                        {p.units.length} units
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                      {p.description || "No property description added yet."}
                    </p>
                    <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-xs text-slate-400">
                          Combined asking value
                        </p>
                        <p className="mt-1 font-semibold">{money(total)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          Available units
                        </p>
                        <p className="mt-1 font-semibold">
                          {
                            p.units.filter((u) => u.status === "AVAILABLE")
                              .length
                          }
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {p.units.slice(0, 3).map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center justify-between rounded-lg bg-[#f8f9f7] px-3 py-2 text-xs"
                        >
                          <span className="text-slate-600">
                            {u.unitNumber} · {u.type}
                          </span>
                          <span className="font-semibold">
                            {money(u.price)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 ${u.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" : u.status === "SOLD" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}
                          >
                            {u.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <Building2 className="mx-auto text-slate-300" size={38} />
            <h3 className="mt-4 font-semibold">
              {search ? "No matching properties" : "No properties yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Add your first property to start building the register.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-5 rounded-xl bg-[#174b34] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add property
            </button>
          </div>
        )}
      </Reveal>
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#f8f9f7] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <h2 className="font-semibold">Add a property</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Create a development and its saleable units.
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-6 p-5 sm:p-7">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold">
                  Property information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-500 sm:col-span-2">
                    Property name *
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="e.g. Sainterra Gardens"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Location *
                    <select
                      value={form.location}
                      onChange={(e) => setField("location", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
                    >
                      {locations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Building type *
                    <select
                      value={form.propertyType}
                      onChange={(e) => setField("propertyType", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
                    >
                      {[
                        "Block of flats",
                        "Duplexes",
                        "Bungalows",
                        "Terrace houses",
                        "Mixed development",
                        "Land",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-500 sm:col-span-2">
                    Description
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Describe the property, facilities and access…"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500 sm:col-span-2">
                    <span className="flex items-center gap-2">
                      <ImagePlus size={15} /> Image URLs (one per line)
                    </span>
                    <textarea
                      rows={2}
                      value={form.images}
                      onChange={(e) => setField("images", e.target.value)}
                      placeholder="https://…"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#43815a]"
                    />
                  </label>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Units & pricing</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Each unit has its own price and status.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((old) => ({
                        ...old,
                        units: [
                          ...old.units,
                          {
                            ...blankUnit,
                            unitNumber: `Unit ${String(old.units.length + 1).padStart(2, "0")}`,
                          },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
                  >
                    <Plus size={14} /> Add unit
                  </button>
                </div>
                <div className="space-y-4">
                  {form.units.map((u, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Unit {i + 1}</p>
                        {form.units.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((old) => ({
                                ...old,
                                units: old.units.filter((_, j) => j !== i),
                              }))
                            }
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-slate-500">
                          Unit number *
                          <input
                            required
                            value={u.unitNumber}
                            onChange={(e) =>
                              updateUnit(i, "unitNumber", e.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Unit type *
                          <select
                            value={u.type}
                            onChange={(e) =>
                              updateUnit(i, "type", e.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                          >
                            {[
                              "Flat",
                              "Duplex",
                              "Bungalow",
                              "Terrace",
                              "Penthouse",
                              "Land plot",
                              "Shop",
                              "Office",
                            ].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-slate-500 sm:col-span-2">
                          Price (NGN) *
                          <input
                            required
                            min="1"
                            type="number"
                            value={u.price}
                            onChange={(e) =>
                              updateUnit(i, "price", e.target.value)
                            }
                            placeholder="85000000"
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Bedrooms
                          <input
                            type="number"
                            min="0"
                            value={u.bedrooms}
                            onChange={(e) =>
                              updateUnit(i, "bedrooms", e.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Bathrooms
                          <input
                            type="number"
                            min="0"
                            value={u.bathrooms}
                            onChange={(e) =>
                              updateUnit(i, "bathrooms", e.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-[#f8f9f7] py-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  className="flex-1 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedProperty(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-action-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2
                  id="property-action-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {selectedProperty.name}
                </h2>

                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={14} />
                  {selectedProperty.location}
                </p>
              </div>

              <button
                onClick={() => setSelectedProperty(null)}
                aria-label="Close property actions"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-500">
              What would you like to do with this property?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const property = selectedProperty;
                  setSelectedProperty(null);

                  router.push(
                    `/buyers`,
                  );
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#174b34] hover:bg-[#f4f8f4]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-400 text-[#174b34]">
                  <UserPlus size={21} />
                </span>

                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Add buyer
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Register a buyer for this property.
                  </span>
                </span>
              </button>

               <button
                onClick={() => {
                  const property = selectedProperty;
                  setSelectedProperty(null);

                  router.push(
                    `/properties`,
                  );
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#174b34] hover:bg-[#f4f8f4]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-400 text-black">
                  <ExternalLink size={20} />
                </span>

                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    View details
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    View property information, owners.
                  </span>
                </span>
              </button>

              <button
                onClick={() => {
                  const property = selectedProperty;
                  setSelectedProperty(null);

                  router.push(
                    `/properties`,
                  );
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#174b34] hover:bg-[#f4f8f4]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-yellow-400 text-slate-700">
                  <Pencil size={20} />
                </span>

                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Edit details
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Update property information, units and pricing.
                  </span>
                </span>
              </button>

               <button
                onClick={() => {
                  const property = selectedProperty;
                  setSelectedProperty(null);

                  router.push(
                    `/properties`,
                  );
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#174b34] hover:bg-red-50"
              >
                <span className="grid bg-red-400 h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
                  <Trash2 size={20} />
                </span>

                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                   Delete Property
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Permanently delete this property and all its units.
                  </span>
                </span>
              </button>
            </div>

            <button
              onClick={() => setSelectedProperty(null)}
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
