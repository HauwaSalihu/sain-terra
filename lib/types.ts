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
export type Offer = {
  _id: string; buyer: Buyer | string; property: Property | string; unit: Unit | string;
  agreedPrice: number; paymentPlan: PaymentPlan; status: string;
  amountPaid?: number; balance?: number; createdAt?: string;
  initialDeposit?: number; installmentMonths?: number; validUntil?: string;
  specialTerms?: string; notes?: string; offerNumber?: string;
};
export type Payment = {
  _id: string; offer: Offer | string; amount: number; method: string; reference: string;
  status: PaymentStatus; paidAt: string; receiptNumber?: string; receivedBy?: string; note?: string;
};
export type Role = "ADMIN" | "MANAGER" | "ACCOUNTS" | "AGENT";
export type User = { _id?: string; id?: string; name?: string; email: string; role?: Role; active?: boolean };
