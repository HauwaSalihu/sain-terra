import { Router } from "express";
import { RECEIPT_SIGNATURES_REQUIRED } from "../../../lib/roles";
import { eSignatureOf } from "../esign";
import { assertId, handle, HttpError, num, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { nextNumber, Offer, Payment, Property } from "../models";

const router = Router();
const METHODS = ["BANK_TRANSFER", "CASH", "POS", "CHEQUE", "OTHER"];
const OPEN_OFFER = { $in: ["DRAFT", "ACTIVE"] };

router.get("/", requirePermission("payments.view"), handle(async (_req, res) => {
  res.json(await Payment.find().sort({ paidAt: -1 }));
}));

router.post("/", requirePermission("payments.record"), handle(async (req, res) => {
  const body = req.body || {};
  const offer = await Offer.findById(assertId(body.offer, "offer"));
  if (!offer || !["DRAFT", "ACTIVE"].includes(offer.status)) throw new HttpError(404, "Offer not found or already closed.");
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
 * A super administrator e-signs the receipt. Once the required number of
 * different super administrators have signed, the payment is confirmed: it is
 * added to the offer, gets a receipt number and, when the total is paid, the
 * offer completes and the unit is marked SOLD.
 */
router.post("/:id/authorize", requirePermission("receipts.authorize"), handle(async (req, res) => {
  const id = assertId(req.params.id);
  const me = req.user!;
  const stamp = await eSignatureOf(me);

  const signed = await Payment.findOneAndUpdate(
    {
      _id: id, status: "PENDING", "authorizations.user": { $ne: me._id },
      $expr: { $lt: [{ $size: "$authorizations" }, RECEIPT_SIGNATURES_REQUIRED] },
    },
    { $push: { authorizations: stamp } },
    { new: true },
  );
  if (!signed) {
    const current = await Payment.findById(id);
    if (!current) throw new HttpError(404, "Payment not found.");
    if (current.status !== "PENDING") throw new HttpError(409, "This receipt is already finalised.");
    throw new HttpError(409, "You have already signed this receipt. It needs another super administrator's signature.");
  }
  if (signed.authorizations.length < RECEIPT_SIGNATURES_REQUIRED) return res.json(signed);

  // Final signature: claim the payment so it can only be finalised once.
  const claimed = await Payment.findOneAndUpdate(
    { _id: id, status: "PENDING" },
    { $set: { status: "CONFIRMED", confirmedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return res.json(await Payment.findById(id));

  const offer = await Offer.findOneAndUpdate(
    { _id: claimed.offer, status: OPEN_OFFER, $expr: { $lte: [{ $add: ["$amountPaid", claimed.amount] }, "$agreedPrice"] } },
    { $inc: { amountPaid: claimed.amount } },
    { new: true },
  );
  if (!offer) {
    // Undo this signature so the receipt can be corrected and re-signed.
    await Payment.updateOne({ _id: id }, { $set: { status: "PENDING" }, $unset: { confirmedAt: 1 }, $pull: { authorizations: { user: me._id } } });
    throw new HttpError(409, "This payment would take the offer above its total price, or the offer is closed. Check the amount.");
  }

  claimed.receiptNumber = await nextNumber("RC");
  await claimed.save();
  if (offer.amountPaid >= offer.agreedPrice) {
    offer.status = "COMPLETED";
    await offer.save();
    await Property.updateOne({ _id: offer.property, "units._id": offer.unit }, { $set: { "units.$.status": "SOLD" } });
  }
  res.json(claimed);
}));

export default router;
