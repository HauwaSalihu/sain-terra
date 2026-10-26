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
export type Buyer = { _id: string; fullName: string; email?: string; phone: string; address?: string };
export type Offer = {
  _id: string; buyer: Buyer | string; property: Property | string; unit: Unit | string;
  agreedPrice: number; paymentPlan: "FULL" | "INSTALLMENTS"; status: string;
  amountPaid?: number; balance?: number; createdAt?: string;
};
export type Payment = {
  _id: string; offer: string; amount: number; method: string; reference: string;
  status: PaymentStatus; paidAt: string; receiptNumber?: string;
};
