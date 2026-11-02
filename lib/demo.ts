/**
 * Demo mode: a stand-in for the backend that runs entirely in the browser,
 * so the portal can be tried without the API or a database. Data is kept in
 * localStorage and follows the same rules as server/ (unit reservation,
 * balance checks, two-signature receipts, offer approval, role checks).
 */
import { can, RECEIPT_SIGNATURES_REQUIRED, type Permission } from "./roles";
import type { Buyer, ESignature, Offer, Payment, Property, Role, Unit, User, Verification } from "./types";

const FLAG = "demoMode";
const DB = "demoDb.v2";
const USER = "demoUser";

type DemoUser = User & { _id: string; active: boolean };
type Db = {
  properties: Property[]; buyers: Buyer[]; offers: Offer[]; payments: Payment[];
  users: DemoUser[]; signatures: { _id: string; user: string; image: string }[];
  counters: Record<string, number>;
};

export const isDemo = () => typeof window !== "undefined" && localStorage.getItem(FLAG) === "1";

/** Staff accounts in the demo, to switch between. */
export const demoUsers = (): DemoUser[] => load().users.filter((u) => u.active);
export const demoUserId = () => localStorage.getItem(USER) || "";

export function startDemo(role: Role) {
  localStorage.setItem(FLAG, "1");
  localStorage.setItem("accessToken", "demo");
  const user = load().users.find((u) => u.role === role && u.active);
  if (user) localStorage.setItem(USER, user._id);
}

export function setDemoUser(userId: string) {
  localStorage.setItem(USER, userId);
}

export function resetDemoData() {
  localStorage.removeItem(IMAGES);
  imageCache = null;
  const db = seed();
  save(db);
  const current = db.users.find((u) => u.role === "SUPER_ADMIN");
  if (current) localStorage.setItem(USER, current._id);
}

/**
 * Demo photos are kept apart from the rest of the demo data, and only the
 * small version is stored, because browser storage holds about 5 MB.
 */
const IMAGES = "demoImages.v1";
let imageCache: Record<string, string> | null = null;
function demoImages(): Record<string, string> {
  if (!imageCache) {
    try {
      imageCache = JSON.parse(localStorage.getItem(IMAGES) || "{}");
    } catch {
      imageCache = {};
    }
  }
  return imageCache!;
}

export const demoImage = (imageId: string, _size: "thumb" | "full") => demoImages()[imageId] || "";

export function stopDemo() {
  localStorage.removeItem(FLAG);
  localStorage.removeItem(USER);
}

const id = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/** A handwritten-looking placeholder signature for the demo accounts. */
function sampleSignature(name: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 420;
  c.height = 130;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "italic 58px 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive";
  ctx.fillText(name, 14, 88);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 104);
  ctx.bezierCurveTo(140, 92, 260, 118, 400, 98);
  ctx.stroke();
  return c.toDataURL("image/png");
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

  const users: DemoUser[] = [
    { _id: id(), name: "Iliya Nathan", title: "MD/CEO", email: "ceo@demo.sainterra", role: "SUPER_ADMIN", active: true },
    { _id: id(), name: "Stanley Amos", title: "COO", email: "coo@demo.sainterra", role: "SUPER_ADMIN", active: true },
    { _id: id(), name: "Demo Administrator", email: "admin@demo.sainterra", role: "ADMIN", active: true },
    { _id: id(), name: "Sales Manager", email: "manager@demo.sainterra", role: "MANAGER", active: true },
    { _id: id(), name: "Sharon", email: "sharon@demo.sainterra", role: "ACCOUNTS", active: true },
    { _id: id(), name: "Sales Agent", email: "agent@demo.sainterra", role: "AGENT", active: true },
  ];
  const [ceo, coo] = users;
  const signatures = [
    { _id: id(), user: ceo._id, image: sampleSignature("I. Nathan", "#1c2470") },
    { _id: id(), user: coo._id, image: sampleSignature("S. Amos", "#16161a") },
  ];
  ceo.signature = signatures[0]._id;
  coo.signature = signatures[1]._id;
  const sign = (u: DemoUser, ago: number): ESignature => ({
    user: u._id, name: u.name!, title: u.title, signature: u.signature!, signedAt: daysAgo(ago),
  });

  const offer = (n: number, b: Buyer, p: Property, u: Unit, extra: Partial<Offer>): Offer => ({
    _id: id(), offerNumber: `ST/OL/2026/${String(n).padStart(4, "0")}`, buyer: b._id, property: p._id, unit: u._id,
    agreedPrice: u.price, paymentPlan: "INSTALLMENTS", status: "ACTIVE", amountPaid: 0, verifyToken: token(), ...extra,
  });
  const offers = [
    offer(1, buyers[0], katampe1, katampe1.units[0], { paymentPlan: "FULL", initialDeposit: 180_000_000, status: "COMPLETED", amountPaid: 180_000_000, createdAt: daysAgo(75), approval: sign(ceo, 75) }),
    offer(2, buyers[1], jahi, jahi.units[0], { initialDeposit: 20_000_000, installmentMonths: 9, amountPaid: 35_000_000, createdAt: daysAgo(60), approval: sign(coo, 59) }),
    offer(3, buyers[2], katampe2, katampe2.units[0], { initialDeposit: 30_000_000, installmentMonths: 12, amountPaid: 0, createdAt: daysAgo(3), status: "DRAFT" }),
    offer(4, buyers[3], guzape, guzape.units[0], { initialDeposit: 100_000_000, installmentMonths: 6, amountPaid: 100_000_000, createdAt: daysAgo(15), approval: sign(ceo, 15) }),
  ];
  let rc = 0;
  const payment = (o: Offer, amount: number, ago: number, signers: DemoUser[]): Payment => {
    const confirmed = signers.length >= RECEIPT_SIGNATURES_REQUIRED;
    return {
      _id: id(), offer: o._id, amount, method: "BANK_TRANSFER", reference: `TRF${100000 + Math.floor(Math.random() * 899999)}`,
      status: confirmed ? "CONFIRMED" : "PENDING", paidAt: daysAgo(ago), verifyToken: token(),
      receiptNumber: confirmed ? `ST/RC/2026/${String(++rc).padStart(5, "0")}` : undefined,
      authorizations: signers.map((u) => sign(u, Math.max(0, ago - 1))),
    };
  };
  const payments = [
    payment(offers[0], 100_000_000, 74, [coo, ceo]), payment(offers[0], 80_000_000, 50, [coo, ceo]),
    payment(offers[1], 20_000_000, 58, [coo, ceo]), payment(offers[1], 15_000_000, 28, [coo, ceo]),
    payment(offers[2], 30_000_000, 2, [coo]),
    payment(offers[3], 100_000_000, 14, [coo, ceo]),
  ];
  return { properties, buyers, offers, payments, users, signatures, counters: { OL: offers.length, RC: rc } };
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

function eSignatureOf(me: DemoUser): ESignature {
  if (!me.signature) fail("Add your e-signature first (My e-signature page) before signing documents.");
  return { user: me._id, name: me.name!, title: me.title, signature: me.signature!, signedAt: new Date().toISOString() };
}

function verify(db: Db, code: string): Verification {
  const describe = (offerId: string) => {
    const o = db.offers.find((x) => x._id === offerId);
    const p = o && db.properties.find((x) => x._id === o.property);
    const u = p?.units.find((x) => x._id === o!.unit);
    return {
      offer: o,
      details: { subscriber: o && db.buyers.find((b) => b._id === o.buyer)?.fullName, property: p?.name, location: p?.location, unit: u ? `${u.unitNumber} · ${u.type}` : undefined },
    };
  };
  const signer = (s: ESignature) => ({ name: s.name, title: s.title, signedAt: s.signedAt });
  const pay = db.payments.find((p) => p.verifyToken === code);
  if (pay) {
    const { offer, details } = describe(pay.offer as string);
    const paidToDate = offer && pay.status === "CONFIRMED"
      ? Math.min(db.payments.filter((p) => p.offer === offer._id && p.status === "CONFIRMED" && p.paidAt <= pay.paidAt).reduce((s, p) => s + p.amount, 0), offer.agreedPrice)
      : undefined;
    return {
      kind: "receipt", status: pay.status, receiptNumber: pay.receiptNumber, paidAt: pay.paidAt, amount: pay.amount, method: pay.method,
      ...details, total: offer?.agreedPrice, paidToDate,
      balance: offer && paidToDate !== undefined ? Math.max(0, offer.agreedPrice - paidToDate) : undefined,
      signedBy: (pay.authorizations || []).map(signer), signaturesRequired: RECEIPT_SIGNATURES_REQUIRED,
    };
  }
  const o = db.offers.find((x) => x.verifyToken === code);
  if (o) {
    const { details } = describe(o._id);
    return {
      kind: "offer", status: o.status, offerNumber: o.offerNumber, createdAt: o.createdAt, ...details,
      agreedPrice: o.agreedPrice, paymentPlan: o.paymentPlan, approvedBy: o.approval ? signer(o.approval) : undefined,
    };
  }
  return fail("No document matches this code.");
}

type Body = Record<string, unknown>;

/** Handles the same paths and methods as the real API. */
export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 120));
  const method = (init.method || "GET").toUpperCase();
  const body: Body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const db = load();
  const me = db.users.find((u) => u._id === demoUserId() && u.active) || db.users[0];
  const role = me.role;
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
    if (resource === "verify") return done(verify(db, rid));

    if (resource === "auth") {
      if (rid === "me" && action === "signature") {
        need("receipts.authorize");
        const image = String(body.image || "");
        if (!image.startsWith("data:image/png;base64,")) fail("The signature must be a PNG image.");
        const sig = { _id: id(), user: me._id, image };
        db.signatures.push(sig);
        me.signature = sig._id;
        return done(me);
      }
      if (rid === "me") return done(me);
      return done(undefined);
    }

    if (resource === "images" && method === "POST") {
      need("properties.manage");
      const thumb = String(body.thumb || "");
      if (!/^data:image\/(webp|jpeg);base64,/.test(thumb)) fail("The image must be WebP or JPEG.");
      const imageId = id();
      const store = { ...demoImages(), [imageId]: thumb };
      try {
        localStorage.setItem(IMAGES, JSON.stringify(store));
      } catch {
        fail("Demo storage in this browser is full. Use Reset demo data, or remove some photos.");
      }
      imageCache = store;
      return done({ _id: imageId, width: body.width, height: body.height });
    }

    if (resource === "signatures") {
      const sig = db.signatures.find((x) => x._id === rid);
      if (!sig) fail("Signature not found.");
      return done({ image: sig!.image });
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
        const gone = db.properties.find((p) => p._id === rid)?.images || [];
        db.properties = db.properties.filter((p) => p._id !== rid);
        if (gone.length) {
          const store = { ...demoImages() };
          gone.forEach((ref) => delete store[ref]);
          localStorage.setItem(IMAGES, JSON.stringify(store));
          imageCache = store;
        }
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
      if (action === "approve") {
        need("offers.approve");
        const offer = db.offers.find((o) => o._id === rid);
        if (!offer) fail("Offer not found.");
        if (offer!.status !== "DRAFT") fail("Only draft offers can be approved.");
        offer!.approval = eSignatureOf(me);
        offer!.status = (offer!.amountPaid || 0) >= offer!.agreedPrice ? "COMPLETED" : "ACTIVE";
        return done(withRelations(db, offer!));
      }
      need("offers.create");
      const property = db.properties.find((p) => p._id === body.property);
      const unit = property?.units.find((u) => u._id === body.unit);
      if (!unit || unit.status !== "AVAILABLE") fail("That unit is no longer available.");
      const agreedPrice = Number(body.agreedPrice);
      if (!(agreedPrice > 0)) fail("Offer price must be more than zero.");
      if (Number(body.initialDeposit || 0) > agreedPrice) fail("The initial deposit cannot be more than the offer price.");
      const offer: Offer = {
        ...(body as unknown as Offer), _id: id(), offerNumber: nextNumber(db, "OL"), agreedPrice,
        status: "DRAFT", amountPaid: 0, createdAt: new Date().toISOString(), verifyToken: token(),
      };
      unit!.status = "RESERVED";
      db.offers.push(offer);
      return done(withRelations(db, offer));
    }

    if (resource === "payments") {
      need("payments.view");
      if (method === "GET") return done([...db.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)));
      if (action === "authorize") {
        need("receipts.authorize");
        const stamp = eSignatureOf(me);
        const payment = db.payments.find((p) => p._id === rid);
        if (!payment) fail("Payment not found.");
        if (payment!.status !== "PENDING") fail("This receipt is already finalised.");
        const auths = (payment!.authorizations ||= []);
        if (auths.some((a) => a.user === me._id)) fail("You have already signed this receipt. It needs another super administrator's signature.");
        if (auths.length + 1 >= RECEIPT_SIGNATURES_REQUIRED) {
          const offer = db.offers.find((o) => o._id === payment!.offer);
          if (!offer || !["DRAFT", "ACTIVE"].includes(offer.status)) fail("The offer is closed.");
          if ((offer!.amountPaid || 0) + payment!.amount > offer!.agreedPrice) fail("This payment would take the offer above its total price. Check the amount.");
          auths.push(stamp);
          offer!.amountPaid = (offer!.amountPaid || 0) + payment!.amount;
          payment!.status = "CONFIRMED";
          payment!.receiptNumber = nextNumber(db, "RC");
          if (offer!.amountPaid >= offer!.agreedPrice) {
            offer!.status = "COMPLETED";
            unitStatus(db, offer!.property as string, offer!.unit as string, "SOLD");
          }
        } else {
          auths.push(stamp);
        }
        return done(payment);
      }
      need("payments.record");
      const offer = db.offers.find((o) => o._id === body.offer);
      if (!offer || !["DRAFT", "ACTIVE"].includes(offer.status)) fail("Offer not found or already closed.");
      const amount = Number(body.amount);
      const balance = offer!.agreedPrice - (offer!.amountPaid || 0);
      if (!(amount > 0)) fail("Amount must be more than zero.");
      if (amount > balance) fail(`Amount is more than the outstanding balance of ${balance}.`);
      const payment: Payment = { ...(body as unknown as Payment), _id: id(), amount, status: "PENDING", authorizations: [], verifyToken: token() };
      db.payments.push(payment);
      return done(payment);
    }

    if (resource === "users") {
      need("users.manage");
      if (method === "GET") return done(db.users);
      const guardSuper = (...roles: unknown[]) => {
        if (roles.includes("SUPER_ADMIN") && !can(role, "superadmins.manage")) fail("Only a super administrator can create or change super administrator accounts.");
      };
      if (method === "POST") {
        guardSuper(body.role);
        if (db.users.some((u) => u.email === String(body.email).toLowerCase())) fail("An account with that email already exists.");
        if (String(body.password || "").length < 8) fail("Password must be at least 8 characters.");
        if (body.role === "SUPER_ADMIN" && !String(body.title || "").trim()) fail("Super administrators need a title, e.g. MD/CEO or COO.");
        const user: DemoUser = { _id: id(), name: String(body.name), email: String(body.email).toLowerCase(), role: body.role as Role, title: String(body.title || "").trim(), active: true };
        db.users.push(user);
        return done(user);
      }
      const user = db.users.find((u) => u._id === rid);
      if (!user) fail("Account not found.");
      guardSuper(user!.role, body.role);
      const patched: DemoUser = {
        ...user!,
        ...(body.role ? { role: body.role as Role } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      };
      if (patched.role === "SUPER_ADMIN" && !patched.title) fail("Super administrators need a title.");
      const admin = (u: DemoUser) => (u.role === "ADMIN" || u.role === "SUPER_ADMIN") && u.active;
      if (!admin(patched) && !db.users.some((u) => u._id !== rid && admin(u))) fail("At least one active administrator is required.");
      db.users = db.users.map((u) => (u._id === rid ? patched : u));
      return done(patched);
    }

    return fail("Not found");
  } catch (err) {
    if (err instanceof DemoError) throw new Error(err.message);
    throw err;
  }
}
