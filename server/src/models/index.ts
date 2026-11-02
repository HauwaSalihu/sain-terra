import { randomBytes } from "node:crypto";
import mongoose, { Schema, type InferSchemaType } from "mongoose";
import type { Role } from "../../../lib/types";

const json = {
  toJSON: {
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      delete ret.passwordHash;
      return ret;
    },
  },
};

export const ROLE_VALUES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNTS", "AGENT"];

/** Unguessable code printed as a QR code on receipts and offer letters. */
export const newVerifyToken = () => randomBytes(18).toString("base64url");

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLE_VALUES, required: true },
    title: { type: String, trim: true, default: "" },
    signature: { type: Schema.Types.ObjectId, ref: "Signature" },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true, ...json },
);

/**
 * E-signature images. Never edited or deleted, so a document signed in the
 * past keeps the exact signature it was signed with.
 */
const signatureSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, required: true },
  },
  { timestamps: true, ...json },
);

/** A signature applied to a document, with the signer's name and title at that moment. */
const eSignatureSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    title: String,
    signature: { type: Schema.Types.ObjectId, ref: "Signature", required: true },
    signedAt: { type: Date, required: true },
  },
  { _id: false },
);

const unitSchema = new Schema({
  unitNumber: { type: String, required: true, trim: true },
  type: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["AVAILABLE", "RESERVED", "SOLD", "RENTED"], default: "AVAILABLE" },
  bedrooms: Number,
  bathrooms: Number,
  description: String,
});

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    propertyType: { type: String, required: true },
    description: { type: String, default: "" },
    images: { type: [String], default: [] },
    units: { type: [unitSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, ...json },
);

const buyerSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: String,
    occupation: String,
    nextOfKin: String,
    nextOfKinPhone: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, ...json },
);

const offerSchema = new Schema(
  {
    offerNumber: { type: String, unique: true },
    buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true },
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    unit: { type: Schema.Types.ObjectId, required: true },
    agreedPrice: { type: Number, required: true, min: 1 },
    paymentPlan: { type: String, enum: ["FULL", "INSTALLMENTS"], default: "INSTALLMENTS" },
    initialDeposit: { type: Number, default: 0 },
    installmentMonths: { type: Number, default: 0 },
    validUntil: Date,
    specialTerms: String,
    notes: String,
    status: { type: String, enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"], default: "DRAFT" },
    amountPaid: { type: Number, default: 0 },
    approval: eSignatureSchema,
    verifyToken: { type: String, unique: true, default: newVerifyToken },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, ...json },
);
offerSchema.virtual("balance").get(function (this: { agreedPrice: number; amountPaid?: number }) {
  return Math.max(0, this.agreedPrice - (this.amountPaid || 0));
});
offerSchema.set("toJSON", { ...json.toJSON, virtuals: true });

const paymentSchema = new Schema(
  {
    offer: { type: Schema.Types.ObjectId, ref: "Offer", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["BANK_TRANSFER", "CASH", "POS", "CHEQUE", "OTHER"], default: "BANK_TRANSFER" },
    reference: { type: String, default: "" },
    paidAt: { type: Date, required: true },
    status: { type: String, enum: ["PENDING", "CONFIRMED", "REVERSED"], default: "PENDING" },
    receiptNumber: { type: String, unique: true, sparse: true },
    receivedBy: String,
    note: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    authorizations: { type: [eSignatureSchema], default: [] },
    confirmedAt: Date,
    verifyToken: { type: String, unique: true, default: newVerifyToken },
  },
  { timestamps: true, ...json },
);

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

export const User = mongoose.model("User", userSchema);
export const Signature = mongoose.model("Signature", signatureSchema);
export const Property = mongoose.model("Property", propertySchema);
export const Buyer = mongoose.model("Buyer", buyerSchema);
export const Offer = mongoose.model("Offer", offerSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
const Counter = mongoose.model("Counter", counterSchema);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

/** Sequential numbers such as ST/RC/2026/00001, unique even under concurrent requests. */
export async function nextNumber(prefix: "OL" | "RC") {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `ST/${prefix}/${year}/${String(counter.seq).padStart(prefix === "RC" ? 5 : 4, "0")}`;
}
