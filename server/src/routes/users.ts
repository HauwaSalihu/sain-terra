import { Router } from "express";
import bcrypt from "bcryptjs";
import { can } from "../../../lib/roles";
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
/** Signing authority can only be granted or changed by someone who already holds it. */
const guardSuperAdmin = (actorRole: Role | undefined, ...roles: (Role | undefined | null)[]) => {
  if (roles.includes("SUPER_ADMIN") && !can(actorRole, "superadmins.manage")) {
    throw new HttpError(403, "Only a super administrator can create or change super administrator accounts.");
  }
};

router.get("/", handle(async (_req, res) => {
  res.json(await User.find().sort({ name: 1 }));
}));

router.post("/", handle(async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 200);
  const email = str(body.email, 200)?.toLowerCase();
  if (!name || !email) throw new HttpError(400, "Name and email are required.");
  const role = readRole(body.role);
  guardSuperAdmin(req.user!.role, role);
  const title = str(body.title, 100) ?? "";
  if (role === "SUPER_ADMIN" && !title) throw new HttpError(400, "Super administrators need a title, e.g. MD/CEO or COO.");
  if (await User.exists({ email })) throw new HttpError(409, "An account with that email already exists.");
  const user = await User.create({
    name, email, role, title,
    passwordHash: await bcrypt.hash(readPassword(body.password), 12),
  });
  res.status(201).json(user);
}));

router.patch("/:id", handle(async (req, res) => {
  const user = await User.findById(assertId(req.params.id));
  if (!user) throw new HttpError(404, "Account not found.");
  const body = req.body || {};
  const self = String(user._id) === String(req.user!._id);
  guardSuperAdmin(req.user!.role, user.role, body.role);

  if (body.role !== undefined) user.role = readRole(body.role);
  if (body.active !== undefined) user.active = Boolean(body.active);
  if (body.name !== undefined) user.name = str(body.name, 200) || user.name;
  if (body.title !== undefined) user.title = str(body.title, 100) ?? "";
  if (body.password !== undefined) user.passwordHash = await bcrypt.hash(readPassword(body.password), 12);

  const admin = (r: string) => r === "ADMIN" || r === "SUPER_ADMIN";
  if (self && (user.role !== req.user!.role || !user.active)) {
    throw new HttpError(400, "You cannot change your own role or disable your own account.");
  }
  if (user.role === "SUPER_ADMIN" && !user.title) throw new HttpError(400, "Super administrators need a title.");
  // Never leave the portal without an active administrator.
  if (!(admin(user.role) && user.active)) {
    const others = await User.countDocuments({ _id: { $ne: user._id }, role: { $in: ["ADMIN", "SUPER_ADMIN"] }, active: true });
    if (!others) throw new HttpError(400, "At least one active administrator is required.");
  }
  await user.save();
  res.json(user);
}));

export default router;
