/**
 * Demo mode: a stand-in for the backend that runs entirely in the browser,
 * so the portal can be tried without the API or a database. Data is kept in
 * localStorage and follows the same rules as server/ (unit reservation,
 * balance checks, receipt numbers, SOLD on full payment, role checks).
 */
import { can, type Permission } from "./roles";
import type { Buyer, Offer, Payment, Property, Role, Unit, User } from "./types";

const FLAG = "demoMode";
const DB = "demoDb";
const ROLE = "demoRole";

type DemoUser = User & { _id: string; active: boolean };
type Db = {
  properties: Property[]; buyers: Buyer[]; offers: Offer[]; payments: Payment[];
  users: DemoUser[]; counters: Record<string, number>;
};

export const isDemo = () => typeof window !== "undefined" && localStorage.getItem(FLAG) === "1";
export const demoRole = (): Role => (localStorage.getItem(ROLE) as Role) || "ADMIN";

export function startDemo(role: Role) {
  localStorage.setItem(FLAG, "1");
  localStorage.setItem(ROLE, role);
  localStorage.setItem("accessToken", "demo");
  if (!localStorage.getItem(DB)) save(seed());
}

export function setDemoRole(role: Role) {
  localStorage.setItem(ROLE, role);
}

export function resetDemoData() {
  save(seed());
}

export function stopDemo() {
  localStorage.removeItem(FLAG);
  localStorage.removeItem(ROLE);
}

const id = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

function load(): Db {
  try {
    const raw = localStorage.getItem(DB);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupt demo data: start again.
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(db: Db) {
  localStorage.setItem(DB, JSON.stringify(db));
}

function seed(): Db {
  const unit = (n: number, type: string, price: number, status: Unit["status"] = "AVAILABLE", bedrooms = 4): Unit => ({
    _id: id(), unitNumber: `Unit ${String(n).padStart(2, "0")}`, type, price, status, bedrooms, bathrooms: bedrooms,
  });
  const property = (name: string, location: string, propertyType: string, units: Unit[], description: string): Property => ({
    _id: id(), name, location, propertyType, units, description, images: [], createdAt: daysAgo(90),
  });
  const properties = [
    property("Sain Terra Court", "Jahi", "Block of flats", [unit(1, "Flat", 65_000_000, "RESERVED", 3), unit(2, "Flat", 65_000_000, "AVAILABLE", 3), unit(3, "Penthouse", 120_000_000)], "Serviced flats close to Jahi district road."),
    property("Katampe Heights", "Katampe 1", "Duplexes", [unit(1, "Duplex", 180_000_000, "SOLD", 5), unit(2, "Duplex", 180_000_000)], "Hill-view detached duplexes."),
    property("Katampe Ridge", "Katampe 2", "Terrace houses", [unit(1, "Terrace", 95_000_000, "RESERVED"), unit(2, "Terrace", 95_000_000), unit(3, "Terrace", 95_000_000)], "Gated terrace estate."),
    property("Gaduwa Gardens", "Gaduwa", "Land", [unit(1, "Land plot", 25_000_000), unit(2, "Land plot", 25_000_000), unit(3, "Land plot", 30_000_000)], "Residential plots with C of O."),
    property("Gudu Residences", "Gudu", "Bungalows", [unit(1, "Bungalow", 55_000_000, "AVAILABLE", 3), unit(2, "Bungalow", 55_000_000, "AVAILABLE", 3)], "Compact family bungalows."),
    property("Guzape Hills", "Guzape", "Duplexes", [unit(1, "Duplex", 250_000_000, "RESERVED", 5), unit(2, "Duplex", 250_000_000, "AVAILABLE", 5)], "Luxury duplexes in Guzape."),
  ];
  const buyers: Buyer[] = [
    { _id: id(), fullName: "Amina Bello", phone: "08031234567", email: "amina@example.com", address: "12 Aminu Kano Crescent, Wuse 2", occupation: "Architect", createdAt: daysAgo(80) },
    { _id: id(), fullName: "Chinedu Okafor", phone: "08029876543", email: "chinedu@example.com", address: "4 Gana Street, Maitama", createdAt: daysAgo(70) },
    { _id: id(), fullName: "Fatima Yusuf", phone: "07065554433", address: "Plot 9, Gwarinpa", createdAt: daysAgo(40) },
    { _id: id(), fullName: "Tunde Adebayo", phone: "08187776655", email: "tunde@example.com", createdAt: daysAgo(20) },
  ];
  const [jahi, katampe1, katampe2, , , guzape] = properties;
  const offer = (n: number, b: Buyer, p: Property, u: Unit, extra: Partial<Offer>): Offer => ({
    _id: id(), offerNumber: `ST/OL/2026/${String(n).padStart(4, "0")}`, buyer: b._id, property: p._id, unit: u._id,
    agreedPrice: u.price, paymentPlan: "INSTALLMENTS", status: "ACTIVE", amountPaid: 0, ...extra,
  });
  const offers = [
    offer(1, buyers[0], katampe1, katampe1.units[0], { paymentPlan: "FULL", initialDeposit: 180_000_000, status: "COMPLETED", amountPaid: 180_000_000, createdAt: daysAgo(75) }),
    offer(2, buyers[1], jahi, jahi.units[0], { initialDeposit: 20_000_000, installmentMonths: 9, amountPaid: 35_000_000, createdAt: daysAgo(60) }),
    offer(3, buyers[2], katampe2, katampe2.units[0], { initialDeposit: 30_000_000, installmentMonths: 12, amountPaid: 0, createdAt: daysAgo(30) }),
    offer(4, buyers[3], guzape, guzape.units[0], { initialDeposit: 100_000_000, installmentMonths: 6, amountPaid: 100_000_000, createdAt: daysAgo(15) }),
  ];
  let rc = 0;
  const payment = (o: Offer, amount: number, ago: number, status: Payment["status"] = "CONFIRMED"): Payment => ({
    _id: id(), offer: o._id, amount, method: "BANK_TRANSFER", reference: `TRF${100000 + Math.floor(Math.random() * 899999)}`,
    status, paidAt: daysAgo(ago), receiptNumber: status === "CONFIRMED" ? `ST/RC/2026/${String(++rc).padStart(5, "0")}` : undefined,
  });
  const payments = [
    payment(offers[0], 100_000_000, 74), payment(offers[0], 80_000_000, 50),
    payment(offers[1], 20_000_000, 58), payment(offers[1], 15_000_000, 28),
    payment(offers[2], 30_000_000, 2, "PENDING"),
    payment(offers[3], 100_000_000, 14),
  ];
  const users: DemoUser[] = [
    { _id: id(), name: "Demo Administrator", email: "admin@demo.sainterra", role: "ADMIN", active: true },
    { _id: id(), name: "Mr Nathan", email: "nathan@demo.sainterra", role: "MANAGER", active: true },
    { _id: id(), name: "Sharon", email: "sharon@demo.sainterra", role: "ACCOUNTS", active: true },
    { _id: id(), name: "Sales Agent", email: "agent@demo.sainterra", role: "AGENT", active: true },
  ];
  return { properties, buyers, offers, payments, users, counters: { OL: offers.length, RC: rc } };
}

class DemoError extends Error {}
const fail = (message: string): never => {
  throw new DemoError(message);
};

function nextNumber(db: Db, prefix: "OL" | "RC") {
  db.counters[prefix] = (db.counters[prefix] || 0) + 1;
  return `ST/${prefix}/${new Date().getFullYear()}/${String(db.counters[prefix]).padStart(prefix === "RC" ? 5 : 4, "0")}`;
}

function withRelations(db: Db, o: Offer): Offer {
  const property = db.properties.find((p) => p._id === o.property);
  return {
    ...o,
    buyer: db.buyers.find((b) => b._id === o.buyer) || o.buyer,
    property: property || o.property,
    unit: property?.units.find((u) => u._id === o.unit) || o.unit,
    balance: Math.max(0, o.agreedPrice - (o.amountPaid || 0)),
  };
}

const unitStatus = (db: Db, propertyId: string, unitId: string, status: Unit["status"]) => {
  const u = db.properties.find((p) => p._id === propertyId)?.units.find((x) => x._id === unitId);
  if (u) u.status = status;
};

type Body = Record<string, unknown>;

/** Handles the same paths and methods as the real API. */
export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 120));
  const method = (init.method || "GET").toUpperCase();
  const body: Body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const db = load();
  const role = demoRole();
  const me = db.users.find((u) => u.role === role && u.active) || db.users[0];
  const need = (p: Permission) => {
    if (!can(role, p)) fail("Your role does not allow this action.");
  };
  const segs = path.split("?")[0].split("/").filter(Boolean);
  const [resource, rid, action] = segs;
  const done = <R>(value: R) => {
    save(db);
    return value as unknown as T;
  };

  try {
    if (resource === "auth") {
      if (rid === "me") return done({ ...me, role });
      return done(undefined);
    }

    if (resource === "dashboard") {
      const units = db.properties.flatMap((p) => p.units);
      return done({
        properties: db.properties.length,
        units: units.length,
        available: units.filter((u) => u.status === "AVAILABLE").length,
        sold: units.filter((u) => u.status === "SOLD").length,
        collected: db.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0),
        outstanding: db.offers.filter((o) => o.status === "ACTIVE").reduce((s, o) => s + Math.max(0, o.agreedPrice - (o.amountPaid || 0)), 0),
        recentProperties: [...db.properties].reverse().slice(0, 5),
      });
    }

    if (resource === "properties") {
      if (method === "GET") return done([...db.properties].reverse());
      if (method === "DELETE") {
        need("properties.delete");
        if (db.offers.some((o) => o.property === rid)) fail("This property has offers against it and cannot be deleted.");
        db.properties = db.properties.filter((p) => p._id !== rid);
        return done(undefined);
      }
      need("properties.manage");
      const units = (body.units as (Unit & { price: number })[]) || [];
      if (!units.length) fail("Add at least one unit.");
      const existing = rid ? db.properties.find((p) => p._id === rid) : undefined;
      if (rid && !existing) fail("Property not found.");
      for (const u of existing?.units || []) {
        if (!units.some((x) => x._id === u._id) && u.status !== "AVAILABLE") fail(`${u.unitNumber} is ${u.status.toLowerCase()} and cannot be removed.`);
      }
      const next: Property = {
        _id: existing?._id || id(),
        name: String(body.name || ""), location: String(body.location || ""), propertyType: String(body.propertyType || ""),
        description: String(body.description || ""), images: (body.images as string[]) || [], createdAt: existing?.createdAt || new Date().toISOString(),
        units: units.map((u) => {
          const prev = existing?.units.find((x) => x._id === u._id);
          return { ...u, _id: prev?._id || id(), price: Number(u.price), status: prev?.status || "AVAILABLE" };
        }),
      };
      db.properties = existing ? db.properties.map((p) => (p._id === rid ? next : p)) : [...db.properties, next];
      return done(next);
    }

    if (resource === "buyers") {
      if (method === "GET") return done([...db.buyers].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      need("subscribers.manage");
      if (!body.fullName || !body.phone) fail("Name and phone are required.");
      const buyer = { ...(body as unknown as Buyer), _id: id(), createdAt: new Date().toISOString() };
      db.buyers.push(buyer);
      return done(buyer);
    }

    if (resource === "offers") {
      if (method === "GET") return done([...db.offers].reverse().map((o) => withRelations(db, o)));
      need("offers.create");
      const property = db.properties.find((p) => p._id === body.property);
      const unit = property?.units.find((u) => u._id === body.unit);
      if (!unit || unit.status !== "AVAILABLE") fail("That unit is no longer available.");
      const agreedPrice = Number(body.agreedPrice);
      if (!(agreedPrice > 0)) fail("Offer price must be more than zero.");
      if (Number(body.initialDeposit || 0) > agreedPrice) fail("The initial deposit cannot be more than the offer price.");
      const offer: Offer = {
        ...(body as unknown as Offer), _id: id(), offerNumber: nextNumber(db, "OL"), agreedPrice,
        status: "ACTIVE", amountPaid: 0, createdAt: new Date().toISOString(),
      };
      unit!.status = "RESERVED";
      db.offers.push(offer);
      return done(withRelations(db, offer));
    }

    if (resource === "payments") {
      need("payments.view");
      if (method === "GET") return done([...db.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)));
      if (action === "confirm") {
        need("payments.confirm");
        const payment = db.payments.find((p) => p._id === rid);
        if (!payment || payment.status !== "PENDING") fail("Only pending payments can be confirmed.");
        const offer = db.offers.find((o) => o._id === payment!.offer);
        if (!offer || offer.status !== "ACTIVE") fail("Offer not found.");
        if ((offer!.amountPaid || 0) + payment!.amount > offer!.agreedPrice) fail("This payment would take the offer above its total price.");
        offer!.amountPaid = (offer!.amountPaid || 0) + payment!.amount;
        payment!.status = "CONFIRMED";
        payment!.receiptNumber = nextNumber(db, "RC");
        if (offer!.amountPaid >= offer!.agreedPrice) {
          offer!.status = "COMPLETED";
          unitStatus(db, offer!.property as string, offer!.unit as string, "SOLD");
        }
        return done(payment);
      }
      need("payments.record");
      const offer = db.offers.find((o) => o._id === body.offer);
      if (!offer || offer.status === "CANCELLED") fail("Offer not found.");
      const amount = Number(body.amount);
      const balance = offer!.agreedPrice - (offer!.amountPaid || 0);
      if (!(amount > 0)) fail("Amount must be more than zero.");
      if (amount > balance) fail(`Amount is more than the outstanding balance of ${balance}.`);
      const payment: Payment = { ...(body as unknown as Payment), _id: id(), amount, status: "PENDING" };
      db.payments.push(payment);
      return done(payment);
    }

    if (resource === "users") {
      need("users.manage");
      if (method === "GET") return done(db.users);
      if (method === "POST") {
        if (db.users.some((u) => u.email === String(body.email).toLowerCase())) fail("An account with that email already exists.");
        if (String(body.password || "").length < 8) fail("Password must be at least 8 characters.");
        const user: DemoUser = { _id: id(), name: String(body.name), email: String(body.email).toLowerCase(), role: body.role as Role, active: true };
        db.users.push(user);
        return done(user);
      }
      const user = db.users.find((u) => u._id === rid);
      if (!user) fail("Account not found.");
      const patched = { ...user!, ...(body.role ? { role: body.role as Role } : {}), ...(body.active !== undefined ? { active: Boolean(body.active) } : {}) };
      if (!db.users.some((u) => u._id !== rid && u.role === "ADMIN" && u.active) && !(patched.role === "ADMIN" && patched.active)) {
        fail("At least one active administrator is required.");
      }
      db.users = db.users.map((u) => (u._id === rid ? patched : u));
      return done(patched);
    }

    return fail("Not found");
  } catch (err) {
    if (err instanceof DemoError) throw new Error(err.message);
    throw err;
  }
}
