import { Router } from "express";
import { assertId, handle, HttpError, num, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { Image, Offer, Property } from "../models";
import { LOCATIONS } from "../../../lib/locations";

const router = Router();

const MAX_IMAGES = 12;
const isId = (s: string) => /^[a-f0-9]{24}$/i.test(s);

/** Links uploaded photos to the property and deletes ones it no longer uses. */
async function syncImages(propertyId: unknown, images: string[], previous: string[] = []) {
  const kept = images.filter(isId);
  if (kept.length) await Image.updateMany({ _id: { $in: kept } }, { $set: { property: propertyId } });
  const removed = previous.filter((id) => isId(id) && !kept.includes(id));
  if (removed.length) await Image.deleteMany({ _id: { $in: removed }, property: propertyId });
}

type UnitInput = { _id?: string; unitNumber?: string; type?: string; price?: unknown; bedrooms?: unknown; bathrooms?: unknown; description?: string };

function readProperty(body: Record<string, unknown>) {
  const location = str(body.location, 100);
  if (!location || !(LOCATIONS as readonly string[]).includes(location)) {
    throw new HttpError(400, `Location must be one of: ${LOCATIONS.join(", ")}.`);
  }
  const units = Array.isArray(body.units) ? (body.units as UnitInput[]) : [];
  if (!units.length) throw new HttpError(400, "Add at least one unit.");
  return {
    name: str(body.name, 200),
    location,
    propertyType: str(body.propertyType, 100),
    description: str(body.description) ?? "",
    images: Array.isArray(body.images) ? body.images.map((s) => str(s, 1000)).filter(Boolean).slice(0, MAX_IMAGES) as string[] : [],
    units: units.map((u) => ({
      _id: u._id,
      unitNumber: str(u.unitNumber, 100),
      type: str(u.type, 100),
      price: num(u.price, "Unit price", { min: 1 }),
      bedrooms: u.bedrooms === "" || u.bedrooms == null ? undefined : num(u.bedrooms, "Bedrooms"),
      bathrooms: u.bathrooms === "" || u.bathrooms == null ? undefined : num(u.bathrooms, "Bathrooms"),
      description: str(u.description) ?? "",
    })),
  };
}

router.get("/", handle(async (_req, res) => {
  res.json(await Property.find().sort({ createdAt: -1 }));
}));

router.get("/:id", handle(async (req, res) => {
  const property = await Property.findById(assertId(req.params.id));
  if (!property) throw new HttpError(404, "Property not found.");
  res.json(property);
}));

router.post("/", requirePermission("properties.manage"), handle(async (req, res) => {
  const data = readProperty(req.body || {});
  const property = await Property.create({
    ...data,
    units: data.units.map(({ _id: _ignored, ...u }) => ({ ...u, status: "AVAILABLE" })),
    createdBy: req.user!._id,
  });
  await syncImages(property._id, data.images as string[]);
  res.status(201).json(property);
}));

router.patch("/:id", requirePermission("properties.manage"), handle(async (req, res) => {
  const property = await Property.findById(assertId(req.params.id));
  if (!property) throw new HttpError(404, "Property not found.");
  const data = readProperty(req.body || {});
  const previousImages = [...property.images];

  // Unit status is never set from this form: it follows offers and payments.
  const existing = new Map(property.units.map((u) => [String(u._id), u]));
  const kept = new Set(data.units.map((u) => u._id).filter(Boolean).map(String));
  for (const [id, unit] of existing) {
    if (!kept.has(id) && unit.status !== "AVAILABLE") {
      throw new HttpError(409, `${unit.unitNumber} is ${unit.status.toLowerCase()} and cannot be removed.`);
    }
  }
  property.set({
    name: data.name, location: data.location, propertyType: data.propertyType,
    description: data.description, images: data.images,
    units: data.units.map((u) => {
      const prev = u._id ? existing.get(String(u._id)) : undefined;
      const { _id, ...rest } = u;
      return prev ? { ...rest, _id: prev._id, status: prev.status } : { ...rest, status: "AVAILABLE" };
    }),
  });
  await property.save();
  await syncImages(property._id, data.images as string[], previousImages);
  res.json(property);
}));

router.delete("/:id", requirePermission("properties.delete"), handle(async (req, res) => {
  const id = assertId(req.params.id);
  if (await Offer.exists({ property: id })) {
    throw new HttpError(409, "This property has offers against it and cannot be deleted.");
  }
  const deleted = await Property.findByIdAndDelete(id);
  if (!deleted) throw new HttpError(404, "Property not found.");
  await Image.deleteMany({ property: deleted._id });
  res.status(204).end();
}));

export default router;
