import { Router } from "express";
import { assertId, handle, HttpError, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { Buyer } from "../models";

const router = Router();

const fields = ["fullName", "phone", "email", "address", "occupation", "nextOfKin", "nextOfKinPhone"] as const;
const read = (body: Record<string, unknown>) =>
  Object.fromEntries(fields.map((f) => [f, str(body[f], 500)]).filter(([, v]) => v !== undefined));

router.get("/", handle(async (_req, res) => {
  res.json(await Buyer.find().sort({ fullName: 1 }));
}));

router.post("/", requirePermission("subscribers.manage"), handle(async (req, res) => {
  const buyer = await Buyer.create({ ...read(req.body || {}), createdBy: req.user!._id });
  res.status(201).json(buyer);
}));

router.patch("/:id", requirePermission("subscribers.manage"), handle(async (req, res) => {
  const buyer = await Buyer.findByIdAndUpdate(assertId(req.params.id), read(req.body || {}), { new: true, runValidators: true });
  if (!buyer) throw new HttpError(404, "Subscriber not found.");
  res.json(buyer);
}));

export default router;
