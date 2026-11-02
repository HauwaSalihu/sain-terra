import { Router } from "express";
import { assertId, handle, HttpError } from "../http";
import { Signature } from "../models";

const router = Router();

// Signature images are only ever served to signed-in staff, for printing.
router.get("/:id", handle(async (req, res) => {
  const signature = await Signature.findById(assertId(req.params.id));
  if (!signature) throw new HttpError(404, "Signature not found.");
  res.set("Cache-Control", "private, max-age=86400");
  res.json({ image: signature.image });
}));

export default router;
