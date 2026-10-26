import type { Role } from "./types";

/**
 * Role based access. The portal is internal only: there is no public sign-up,
 * accounts are created by an ADMIN on the Staff page. The backend must enforce
 * the same rules; this map only decides what the UI shows.
 */
export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "ADMIN", label: "Administrator", description: "Full access, including staff accounts and deletions." },
  { value: "MANAGER", label: "Manager", description: "Manages properties, subscribers, offers and confirms payments." },
  { value: "ACCOUNTS", label: "Accounts", description: "Records and confirms payments, issues receipts." },
  { value: "AGENT", label: "Agent", description: "Registers subscribers, drafts offers and logs pending payments." },
];

export type Permission =
  | "properties.manage"
  | "properties.delete"
  | "subscribers.manage"
  | "offers.create"
  | "payments.view"
  | "payments.record"
  | "payments.confirm"
  | "receipts.issue"
  | "users.manage";

const grants: Record<Role, Permission[]> = {
  ADMIN: [
    "properties.manage", "properties.delete", "subscribers.manage", "offers.create",
    "payments.view", "payments.record", "payments.confirm", "receipts.issue", "users.manage",
  ],
  MANAGER: [
    "properties.manage", "subscribers.manage", "offers.create",
    "payments.view", "payments.record", "payments.confirm", "receipts.issue",
  ],
  ACCOUNTS: ["payments.view", "payments.record", "payments.confirm", "receipts.issue"],
  AGENT: ["subscribers.manage", "offers.create", "payments.view", "payments.record"],
};

export function can(role: Role | undefined, permission: Permission) {
  return !!role && grants[role]?.includes(permission);
}

export const roleLabel = (role?: Role) => ROLES.find((r) => r.value === role)?.label || "No role";
