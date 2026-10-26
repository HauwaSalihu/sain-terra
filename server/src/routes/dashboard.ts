import { Router } from "express";
import { handle } from "../http";
import { Offer, Payment, Property } from "../models";

const router = Router();

router.get("/", handle(async (_req, res) => {
  const [properties, collected, activeOffers] = await Promise.all([
    Property.find().sort({ createdAt: -1 }),
    Payment.aggregate<{ total: number }>([{ $match: { status: "CONFIRMED" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Offer.find({ status: "ACTIVE" }, { agreedPrice: 1, amountPaid: 1 }),
  ]);
  const units = properties.flatMap((p) => p.units);
  res.json({
    properties: properties.length,
    units: units.length,
    available: units.filter((u) => u.status === "AVAILABLE").length,
    sold: units.filter((u) => u.status === "SOLD").length,
    collected: collected[0]?.total ?? 0,
    outstanding: activeOffers.reduce((s, o) => s + Math.max(0, o.agreedPrice - o.amountPaid), 0),
    recentProperties: properties.slice(0, 5),
  });
}));

export default router;
