import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { handle, HttpError, str } from "../http";
import { requireAuth } from "../middleware/auth";
import { User } from "../models";

const router = Router();

// Slows down password guessing: 10 attempts per 15 minutes per address.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in 15 minutes." } });

router.post("/login", loginLimiter, handle(async (req, res) => {
  const email = str(req.body?.email, 200)?.toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) throw new HttpError(400, "Email and password are required.");
  const user = await User.findOne({ email });
  // Same message for unknown email and wrong password.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password.");
  }
  if (!user.active) throw new HttpError(403, "This account has been disabled. Contact an administrator.");
  user.lastLoginAt = new Date();
  await user.save();
  const accessToken = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });
  res.json({ accessToken, user: user.toJSON() });
}));

router.get("/me", requireAuth, (req, res) => {
  const { passwordHash: _omit, ...user } = req.user!;
  res.json(user);
});

// Tokens are stateless; the client discards its copy.
router.post("/logout", (_req, res) => {
  res.status(204).end();
});

export default router;
