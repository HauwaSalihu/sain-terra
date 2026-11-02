/**
 * Creates (or resets) a top-level account. This is how the first people get
 * in; everyone else is added from the Staff & access page.
 *
 *   npm run create-admin -- "Iliya Nathan" ceo@example.com --title "MD/CEO"
 *   npm run create-admin -- "Hauwa Salihu" you@example.com --role ADMIN
 *
 * Accounts are super administrators (can e-sign receipts and approve offers)
 * unless --role ADMIN is given. The password is asked for interactively, or
 * read from ADMIN_PASSWORD.
 */
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "../config";
import { User } from "../models";

function flag(args: string[], name: string) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
}

async function askPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password (min 8 characters): ");
  rl.close();
  return password;
}

async function main() {
  const args = process.argv.slice(2);
  const role = (flag(args, "--role") || "SUPER_ADMIN").toUpperCase();
  const title = flag(args, "--title") || "";
  const [name, rawEmail] = args;
  const email = rawEmail?.trim().toLowerCase();
  if (!name || !email || !email.includes("@") || !["SUPER_ADMIN", "ADMIN"].includes(role)) {
    console.error('Usage: npm run create-admin -- "Full Name" you@example.com --title "MD/CEO" [--role ADMIN]');
    process.exit(1);
  }
  if (role === "SUPER_ADMIN" && !title) {
    console.error('Super administrators need a title, e.g. --title "MD/CEO" or --title "COO".');
    process.exit(1);
  }
  const password = await askPassword();
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.set({ name, passwordHash, role, title, active: true });
    await existing.save();
    console.log(`Updated ${email}: active ${role} with the new password.`);
  } else {
    await User.create({ name, email, passwordHash, role, title });
    console.log(`Created ${role} ${email}${title ? ` (${title})` : ""}. Sign in at the website's /login page.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
