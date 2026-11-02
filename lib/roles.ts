import type { Role } from "./types";

/**
 * Role based access. The portal is internal only: there is no public sign-up,
 * accounts are created on the Staff page (super administrators only by another
 * super administrator or the create-admin script). The backend enforces the
 * same rules; this map also decides what the UI shows.
 */
export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "SUPER_ADMIN", label: "Super administrator", description: "CEO / COO. Everything an administrator can do, plus e-signing receipts and approving offer letters." },
  { value: "ADMIN", label: "Administrator", description: "Full access to records and staff accounts, but cannot sign receipts or approve offers." },
  { value: "MANAGER", label: "Manager", description: "Manages properties, subscribers and offers; records payments." },
  { value: "ACCOUNTS", label: "Accounts", description: "Records payments and prints receipts." },
  { value: "AGENT", label: "Agent", description: "Registers subscribers, drafts offers and logs pending payments." },
];

/** Every receipt needs this many different super administrators to e-sign it. */
export const RECEIPT_SIGNATURES_REQUIRED = 2;

export type Permission =
  | "properties.manage"
  | "properties.delete"
  | "subscribers.manage"
  | "offers.create"
  | "offers.approve"
  | "payments.view"
  | "payments.record"
  | "receipts.authorize"
  | "receipts.issue"
  | "users.manage"
  | "superadmins.manage";

const ADMIN: Permission[] = [
  "properties.manage", "properties.delete", "subscribers.manage", "offers.create",
  "payments.view", "payments.record", "receipts.issue", "users.manage",
];

const grants: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...ADMIN, "offers.approve", "receipts.authorize", "superadmins.manage"],
  ADMIN,
  MANAGER: ["properties.manage", "subscribers.manage", "offers.create", "payments.view", "payments.record", "receipts.issue"],
  ACCOUNTS: ["payments.view", "payments.record", "receipts.issue"],
  AGENT: ["subscribers.manage", "offers.create", "payments.view", "payments.record"],
};

export function can(role: Role | undefined, permission: Permission) {
  return !!role && grants[role]?.includes(permission);
}

export const roleLabel = (role?: Role) => ROLES.find((r) => r.value === role)?.label || "No role";
