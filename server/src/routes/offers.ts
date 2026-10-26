import { Router } from "express";
import { assertId, handle, HttpError, num, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { Buyer, nextNumber, Offer, Property } from "../models";

const router = Router();

/** Offers come back with buyer, property and the unit itself filled in. */
async function withRelations(filter: Record<string, unknown> = {}) {
  const offers = await Offer.find(filter).sort({ createdAt: -1 }).populate("buyer").populate("property");
  return offers.map((o) => {
    const json = o.toJSON() as Record<string, unknown> & { property?: { units?: { _id: unknown }[] } };
    const unit = json.property?.units?.find((u) => String(u._id) === String(o.unit));
    return { ...json, unit: unit ?? o.unit };
  });
}

router.get("/", handle(async (_req, res) => {
  res.json(await withRelations());
}));

router.post("/", requirePermission("offers.create"), handle(async (req, res) => {
  const body = req.body || {};
  const buyerId = assertId(body.buyer, "subscriber");
  const propertyId = assertId(body.property, "property");
  const unitId = assertId(body.unit, "unit");
  const agreedPrice = num(body.agreedPrice, "Offer price", { min: 1 });
  const paymentPlan = body.paymentPlan === "FULL" ? "FULL" : "INSTALLMENTS";
  const initialDeposit = paymentPlan === "FULL" ? agreedPrice : num(body.initialDeposit ?? 0, "Initial deposit");
  if (initialDeposit > agreedPrice) throw new HttpError(400, "The initial deposit cannot be more than the offer price.");
  const installmentMonths = paymentPlan === "FULL" ? 0 : num(body.installmentMonths ?? 0, "Instalment months");
  const validUntil = body.validUntil ? new Date(body.validUntil) : undefined;
  if (validUntil && Number.isNaN(validUntil.getTime())) throw new HttpError(400, "Invalid validity date.");

  if (!(await Buyer.exists({ _id: buyerId }))) throw new HttpError(404, "Subscriber not found.");

  // Reserve the unit atomically so two staff cannot offer the same unit.
  const reserved = await Property.updateOne(
    { _id: propertyId, units: { $elemMatch: { _id: unitId, status: "AVAILABLE" } } },
    { $set: { "units.$.status": "RESERVED" } },
  );
  if (!reserved.matchedCount) throw new HttpError(409, "That unit is no longer available.");

  try {
    const offer = await Offer.create({
      offerNumber: await nextNumber("OL"),
      buyer: buyerId, property: propertyId, unit: unitId,
      agreedPrice, paymentPlan, initialDeposit, installmentMonths, validUntil,
      specialTerms: str(body.specialTerms), notes: str(body.notes),
      createdBy: req.user!._id,
    });
    const [full] = await withRelations({ _id: offer._id });
    res.status(201).json(full);
  } catch (err) {
    await Property.updateOne({ _id: propertyId, "units._id": unitId }, { $set: { "units.$.status": "AVAILABLE" } });
    throw err;
  }
}));

export default router;
