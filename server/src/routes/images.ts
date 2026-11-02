import express, { Router } from "express";
import { assertId, handle, HttpError } from "../http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { Image } from "../models";

const router = Router();

const TYPES = ["image/webp", "image/jpeg"];
const MAX_FULL = 1.5 * 1024 * 1024;
const MAX_THUMB = 300 * 1024;

function decode(dataUrl: unknown, max: number, label: string) {
  const match = typeof dataUrl === "string" ? /^data:(image\/(?:webp|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match) throw new HttpError(400, `The ${label} image must be WebP or JPEG.`);
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > max) throw new HttpError(400, `The ${label} image is too large after compression.`);
  return { type: match[1], buffer };
}

/** Upload one photo (full size + thumbnail), already optimised by the browser. */
router.post(
  "/",
  express.json({ limit: "3mb" }),
  requireAuth,
  requirePermission("properties.manage"),
  handle(async (req, res) => {
    const full = decode(req.body?.full, MAX_FULL, "full-size");
    const thumb = decode(req.body?.thumb, MAX_THUMB, "thumbnail");
    if (full.type !== thumb.type || !TYPES.includes(full.type)) throw new HttpError(400, "Unsupported image type.");
    const image = await Image.create({
      contentType: full.type, full: full.buffer, thumb: thumb.buffer,
      width: Number(req.body?.width) || undefined, height: Number(req.body?.height) || undefined,
      createdBy: req.user!._id,
    });
    // Photos uploaded but never saved on a property are cleared after a day.
    await Image.deleteMany({ property: null, createdAt: { $lt: new Date(Date.now() - 864e5) } });
    res.status(201).json({ _id: image._id, width: image.width, height: image.height });
  }),
);

/**
 * Public so <img> tags can load it (property photos are not sensitive).
 * Ids never change content, so browsers may cache them for a year.
 */
router.get("/:id", handle(async (req, res) => {
  const size = req.query.size === "thumb" ? "thumb" : "full";
  const image = await Image.findById(assertId(req.params.id), { [size]: 1, contentType: 1 }).lean();
  if (!image) throw new HttpError(404, "Image not found.");
  res.set({
    "Content-Type": image.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  res.send(image[size]);
}));

export default router;
