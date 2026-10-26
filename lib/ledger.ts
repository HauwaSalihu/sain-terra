import type { Buyer, Offer, Payment, Property, Unit } from "./types";

export const refId = (value: { _id: string } | string | undefined | null) =>
  !value ? "" : typeof value === "string" ? value : value._id;

export const offerBuyer = (o: Offer, buyers: Buyer[] = []) =>
  typeof o.buyer === "object" ? o.buyer : buyers.find((b) => b._id === o.buyer);

export const offerProperty = (o: Offer, properties: Property[] = []) =>
  typeof o.property === "object" ? o.property : properties.find((p) => p._id === o.property);

export function offerUnit(o: Offer, properties: Property[] = []): Unit | undefined {
  if (typeof o.unit === "object") return o.unit;
  return offerProperty(o, properties)?.units?.find((u) => u._id === o.unit);
}

export const paymentsFor = (offerId: string, payments: Payment[]) =>
  payments.filter((p) => refId(p.offer) === offerId);

/** Confirmed money against an offer. The total is never exceeded on paper. */
export function offerTotals(o: Offer, payments: Payment[]) {
  const confirmed = paymentsFor(o._id, payments)
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const paid = Math.min(o.amountPaid ?? confirmed, o.agreedPrice);
  const balance = Math.max(0, o.agreedPrice - paid);
  return { total: o.agreedPrice, paid, balance, fullyPaid: balance === 0 };
}

/**
 * Position of a single payment within its offer: what has been paid up to and
 * including this payment, and what remains. Used on receipts.
 */
export function receiptPosition(p: Payment, offer: Offer | undefined, payments: Payment[]) {
  if (!offer) {
    return { total: 0, paidToDate: p.amount, balance: 0, fullyPaid: false, known: false };
  }
  const when = new Date(p.paidAt).getTime();
  const prior = paymentsFor(offer._id, payments)
    .filter((x) => x._id !== p._id && x.status === "CONFIRMED")
    .filter((x) => new Date(x.paidAt).getTime() <= when)
    .reduce((s, x) => s + x.amount, 0);
  const paidToDate = Math.min(prior + (p.status === "REVERSED" ? 0 : p.amount), offer.agreedPrice);
  const balance = Math.max(0, offer.agreedPrice - paidToDate);
  return { total: offer.agreedPrice, paidToDate, balance, fullyPaid: balance === 0, known: true };
}

export function subscriberRecord(b: Buyer, offers: Offer[], payments: Payment[]) {
  const mine = offers.filter((o) => refId(o.buyer) === b._id);
  const ids = new Set(mine.map((o) => o._id));
  const history = payments
    .filter((p) => ids.has(refId(p.offer)))
    .sort((x, y) => new Date(y.paidAt).getTime() - new Date(x.paidAt).getTime());
  const totals = mine.map((o) => offerTotals(o, payments));
  const offered = totals.reduce((s, t) => s + t.total, 0);
  const paid = totals.reduce((s, t) => s + t.paid, 0);
  const balance = totals.reduce((s, t) => s + t.balance, 0);
  const confirmedCount = history.filter((p) => p.status === "CONFIRMED").length;
  const pendingCount = history.filter((p) => p.status === "PENDING").length;
  const status = !mine.length
    ? "No offer"
    : balance === 0
      ? "Fully paid"
      : confirmedCount
        ? "Paying"
        : "Awaiting first payment";
  return {
    offers: mine, history, offered, paid, balance, confirmedCount, pendingCount,
    lastPayment: history.find((p) => p.status === "CONFIRMED"), status,
    progress: offered ? Math.round((paid / offered) * 100) : 0,
  };
}

const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ones[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? `-${ones[r % 10]}` : ""}`;
  return [h ? `${ones[h]} hundred` : "", rest].filter(Boolean).join(h && r ? " and " : "");
}

/** 1250000 -> "One million, two hundred and fifty thousand naira only" */
export function amountInWords(value: number) {
  let n = Math.floor(Math.abs(value || 0));
  if (!n) return "Zero naira only";
  const scales = ["", "thousand", "million", "billion", "trillion"];
  const parts: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${belowThousand(chunk)}${scales[i] ? ` ${scales[i]}` : ""}`);
  }
  const text = `${parts.join(", ")} naira only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
