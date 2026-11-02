export type UnitStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "REVERSED";
export type Unit = {
  _id: string; unitNumber: string; type: string; price: number;
  status: UnitStatus; bedrooms?: number; bathrooms?: number; description?: string;
};
export type Property = {
  _id: string; name: string; location: string; description: string;
  propertyType: string; images: string[]; units: Unit[]; createdAt?: string;
};
/** A subscriber is a buyer who has (or will have) an offer on a unit. */
export type Buyer = {
  _id: string; fullName: string; email?: string; phone: string; address?: string;
  occupation?: string; nextOfKin?: string; nextOfKinPhone?: string; createdAt?: string;
};
export type PaymentPlan = "FULL" | "INSTALLMENTS";
/** A super administrator's e-signature applied to a document. */
export type ESignature = {
  user: string; name: string; title?: string; signature: string; signedAt: string;
};
export type Offer = {
  _id: string; buyer: Buyer | string; property: Property | string; unit: Unit | string;
  agreedPrice: number; paymentPlan: PaymentPlan; status: string;
  amountPaid?: number; balance?: number; createdAt?: string;
  initialDeposit?: number; installmentMonths?: number; validUntil?: string;
  specialTerms?: string; notes?: string; offerNumber?: string;
  approval?: ESignature; verifyToken?: string;
};
export type Payment = {
  _id: string; offer: Offer | string; amount: number; method: string; reference: string;
  status: PaymentStatus; paidAt: string; receiptNumber?: string; receivedBy?: string; note?: string;
  authorizations?: ESignature[]; verifyToken?: string;
};
export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "ACCOUNTS" | "AGENT";
export type User = {
  _id?: string; id?: string; name?: string; email: string; role?: Role; active?: boolean;
  /** Job title printed beside the name on signed documents, e.g. "MD/CEO". */
  title?: string;
  /** Id of the user's current e-signature, if they have one on file. */
  signature?: string;
};

/** What the public verification page shows for a scanned code. Never includes signature images. */
export type Verification =
  | {
      kind: "receipt"; status: PaymentStatus; receiptNumber?: string; paidAt: string; amount: number; method: string;
      subscriber?: string; property?: string; location?: string; unit?: string;
      total?: number; paidToDate?: number; balance?: number;
      signedBy: { name: string; title?: string; signedAt: string }[]; signaturesRequired: number;
    }
  | {
      kind: "offer"; status: string; offerNumber?: string; createdAt?: string; subscriber?: string;
      property?: string; location?: string; unit?: string; agreedPrice: number; paymentPlan: PaymentPlan;
      approvedBy?: { name: string; title?: string; signedAt: string };
    };
