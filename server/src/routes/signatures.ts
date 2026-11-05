import { Router } from "express";
import mongoose from "mongoose";
import { assertId, handle, HttpError } from "../http";
import { Signature, User } from "../models";

const router = Router();

/**
 * Signature images are only ever served to signed-in staff, for printing.
 * If the exact signature a document was signed with is missing, `?user=`
 * falls back to that signer's current signature so the document still prints.
 */
router.get("/:id", handle(async (req, res) => {
  let signature = await Signature.findById(assertId(req.params.id));
  const signer = typeof req.query.user === "string" && mongoose.isValidObjectId(req.query.user) ? req.query.user : "";
  if (!signature && signer) {
    const user = await User.findById(signer, { signature: 1 });
    if (user?.signature) signature = await Signature.findById(user.signature);
  }
  if (!signature) throw new HttpError(404, "Signature not found.");
  res.set("Cache-Control", "private, max-age=86400");
  res.json({ image: signature.image });
}));

export default router;
