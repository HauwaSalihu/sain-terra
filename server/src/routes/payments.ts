import { Router } from "express";
import { assertId, handle, HttpError, num, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { nextNumber, Offer, Payment, Property } from "../models";

const router = Router();
const METHODS = ["BANK_TRANSFER", "CASH", "POS", "CHEQUE", "OTHER"];

router.get("/", requirePermission("payments.view"), handle(async (_req, res) => {
  res.json(await Payment.find().sort({ paidAt: -1 }));
}));

router.post("/", requirePermission("payments.record"), handle(async (req, res) => {
  const body = req.body || {};
  const offer = await Offer.findById(assertId(body.offer, "offer"));
  if (!offer || offer.status === "CANCELLED") throw new HttpError(404, "Offer not found.");
  const amount = num(body.amount, "Amount", { min: 1 });
  const balance = offer.agreedPrice - offer.amountPaid;
  if (amount > balance) throw new HttpError(400, `Amount is more than the outstanding balance of ${balance}.`);
  const paidAt = new Date(body.paidAt || Date.now());
  if (Number.isNaN(paidAt.getTime())) throw new HttpError(400, "Invalid payment date.");
  const payment = await Payment.create({
    offer: offer._id, amount, paidAt,
    method: METHODS.includes(body.method) ? body.method : "OTHER",
    reference: str(body.reference, 200) ?? "",
    receivedBy: str(body.receivedBy, 200),
    note: str(body.note),
    recordedBy: req.user!._id,
  });
  res.status(201).json(payment);
}));

/**
 * Confirming a payment adds it to the offer, issues a receipt number and,
 * once the total is paid, completes the offer and marks the unit SOLD.
 */
router.patch("/:id/confirm", requirePermission("payments.confirm"), handle(async (req, res) => {
  const id = assertId(req.params.id);
  const payment = await Payment.findOneAndUpdate(
    { _id: id, status: "PENDING" },
    { $set: { status: "CONFIRMED", confirmedBy: req.user!._id, confirmedAt: new Date() } },
    { new: true },
  );
  if (!payment) throw new HttpError(409, "Only pending payments can be confirmed.");

  const offer = await Offer.findOneAndUpdate(
    { _id: payment.offer, status: "ACTIVE", $expr: { $lte: [{ $add: ["$amountPaid", payment.amount] }, "$agreedPrice"] } },
    { $inc: { amountPaid: payment.amount } },
    { new: true },
  );
  if (!offer) {
    await Payment.updateOne({ _id: id }, { $set: { status: "PENDING" }, $unset: { confirmedBy: 1, confirmedAt: 1 } });
    throw new HttpError(409, "This payment would take the offer above its total price. Check the amount.");
  }

  payment.receiptNumber = await nextNumber("RC");
  await payment.save();

  if (offer.amountPaid >= offer.agreedPrice) {
    offer.status = "COMPLETED";
    await offer.save();
    await Property.updateOne({ _id: offer.property, "units._id": offer.unit }, { $set: { "units.$.status": "SOLD" } });
  }
  res.json(payment);
}));

export default router;
