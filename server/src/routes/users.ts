import { Router } from "express";
import bcrypt from "bcryptjs";
import { assertId, handle, HttpError, str } from "../http";
import { requirePermission } from "../middleware/auth";
import { ROLE_VALUES, User } from "../models";
import type { Role } from "../../../lib/types";

const router = Router();
router.use(requirePermission("users.manage"));

const readRole = (value: unknown) => {
  if (!ROLE_VALUES.includes(value as Role)) throw new HttpError(400, `Role must be one of ${ROLE_VALUES.join(", ")}.`);
  return value as Role;
};
const readPassword = (value: unknown) => {
  if (typeof value !== "string" || value.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  return value;
};

router.get("/", handle(async (_req, res) => {
  res.json(await User.find().sort({ name: 1 }));
}));

router.post("/", handle(async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 200);
  const email = str(body.email, 200)?.toLowerCase();
  if (!name || !email) throw new HttpError(400, "Name and email are required.");
  if (await User.exists({ email })) throw new HttpError(409, "An account with that email already exists.");
  const user = await User.create({
    name, email, role: readRole(body.role),
    passwordHash: await bcrypt.hash(readPassword(body.password), 12),
  });
  res.status(201).json(user);
}));

router.patch("/:id", handle(async (req, res) => {
  const user = await User.findById(assertId(req.params.id));
  if (!user) throw new HttpError(404, "Account not found.");
  const body = req.body || {};
  const self = String(user._id) === String(req.user!._id);

  if (body.role !== undefined) user.role = readRole(body.role);
  if (body.active !== undefined) user.active = Boolean(body.active);
  if (body.name !== undefined) user.name = str(body.name, 200) || user.name;
  if (body.password !== undefined) user.passwordHash = await bcrypt.hash(readPassword(body.password), 12);

  if (self && (user.role !== "ADMIN" || !user.active)) {
    throw new HttpError(400, "You cannot remove your own administrator access.");
  }
  // Never leave the portal without an active administrator.
  if (!(user.role === "ADMIN" && user.active)) {
    const others = await User.countDocuments({ _id: { $ne: user._id }, role: "ADMIN", active: true });
    if (!others) throw new HttpError(400, "At least one active administrator is required.");
  }
  await user.save();
  res.json(user);
}));

export default router;
