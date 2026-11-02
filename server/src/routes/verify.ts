import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RECEIPT_SIGNATURES_REQUIRED } from "../../../lib/roles";
import { handle, HttpError } from "../http";
import { Buyer, Offer, Payment, Property } from "../models";

const router = Router();

// Public: anyone holding a printed receipt or offer letter can check it.
router.use(rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many checks. Try again in a minute." } }));

const signer = (s: { name: string; title?: string | null; signedAt: Date }) =>
  ({ name: s.name, title: s.title || undefined, signedAt: s.signedAt });

async function describe(offerId: unknown) {
  const offer = await Offer.findById(offerId);
  if (!offer) return { offer: null };
  const [buyer, property] = await Promise.all([Buyer.findById(offer.buyer), Property.findById(offer.property)]);
  const unit = property?.units.find((u) => String(u._id) === String(offer.unit));
  return {
    offer,
    details: {
      subscriber: buyer?.fullName, property: property?.name, location: property?.location,
      unit: unit ? `${unit.unitNumber} · ${unit.type}` : undefined,
    },
  };
}

router.get("/:token", handle(async (req, res) => {
  const token = String(req.params.token);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new HttpError(404, "No document matches this code.");

  const payment = await Payment.findOne({ verifyToken: token });
  if (payment) {
    const { offer, details } = await describe(payment.offer);
    let paidToDate: number | undefined;
    if (offer && payment.status === "CONFIRMED") {
      const earlier = await Payment.find({ offer: offer._id, status: "CONFIRMED", paidAt: { $lte: payment.paidAt } });
      paidToDate = Math.min(earlier.reduce((s, p) => s + p.amount, 0), offer.agreedPrice);
    }
    return res.json({
      kind: "receipt", status: payment.status, receiptNumber: payment.receiptNumber, paidAt: payment.paidAt,
      amount: payment.amount, method: payment.method, ...details,
      total: offer?.agreedPrice, paidToDate,
      balance: offer && paidToDate !== undefined ? Math.max(0, offer.agreedPrice - paidToDate) : undefined,
      signedBy: payment.authorizations.map(signer), signaturesRequired: RECEIPT_SIGNATURES_REQUIRED,
    });
  }

  const offerDoc = await Offer.findOne({ verifyToken: token });
  if (offerDoc) {
    const { details } = await describe(offerDoc._id);
    return res.json({
      kind: "offer", status: offerDoc.status, offerNumber: offerDoc.offerNumber, createdAt: offerDoc.get("createdAt"),
      ...details, agreedPrice: offerDoc.agreedPrice, paymentPlan: offerDoc.paymentPlan,
      approvedBy: offerDoc.approval ? signer(offerDoc.approval) : undefined,
    });
  }
  throw new HttpError(404, "No document matches this code.");
}));

export default router;
