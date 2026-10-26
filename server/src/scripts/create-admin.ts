/**
 * Creates (or resets) an administrator account. This is how the first person
 * gets in; everyone else is added from the Staff & access page.
 *
 *   npm run create-admin -- "Full Name" you@example.com
 *
 * The password is asked for interactively, or read from ADMIN_PASSWORD.
 */
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "../config";
import { User } from "../models";

async function askPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password (min 8 characters): ");
  rl.close();
  return password;
}

async function main() {
  const [name, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    console.error('Usage: npm run create-admin -- "Full Name" you@example.com');
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
    existing.set({ name, passwordHash, role: "ADMIN", active: true });
    await existing.save();
    console.log(`Updated ${email}: now an active administrator with the new password.`);
  } else {
    await User.create({ name, email, passwordHash, role: "ADMIN" });
    console.log(`Created administrator ${email}. Sign in at the website's /login page.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
