# Sain Terra

Internal real estate portal for Sain Terra (Next.js frontend). It covers properties in
**Jahi, Katampe 1, Katampe 2, Gaduwa, Gudu and Guzape**, subscriber track records, offer
letter automation and digital receipts.

## Quick test (no server needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000, and on the login page click one of the **Demo as …** buttons.
This loads sample properties in all six locations, subscribers, offers and payments.
Everything is saved only in your browser. While in demo mode, a yellow bar at the top lets
you switch roles (to see what Mr Nathan, Sharon or an agent can do) or reset the data.
Logging out leaves demo mode.

## Running for real

You need [MongoDB](https://www.mongodb.com/try/download/community) (or a free MongoDB Atlas
database).

**1. Start the API** (in `server/`):

```bash
cd server
cp .env.example .env        # set MONGODB_URI and a long random JWT_SECRET
npm install
npm run create-admin -- "Your Name" you@example.com   # asks for a password
npm run dev                 # http://localhost:4000/api
```

**2. Start the website** (in the project root, a second terminal):

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                        # http://localhost:3000
```

Sign in with the admin account you just created, then add Mr Nathan, Sharon and the
agents on **Staff & access**.

Optional env vars printed on offer letters and receipts:
`NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_COMPANY_PHONE`, `NEXT_PUBLIC_COMPANY_EMAIL`.

The logo used across the app, offer letters and receipts is `assets/sainlogo.png` (UI) and
`public/sainlogo.png` (printed documents).

## Features

| Area | What it does |
| --- | --- |
| Overview | Portfolio totals and unit availability for each of the six locations. |
| Properties & units | Add / edit / delete properties and units, filter by location, see who holds each unit. |
| Subscribers | Each subscriber's price offered, amount paid, balance, payment history, unit availability and status (Awaiting first payment, Paying, Fully paid). |
| Offer letters | One form (subscriber, unit, price, deposit, instalment months, validity, special terms, signatory) creates the offer and generates a printable / PDF offer letter with the logo. |
| Payments & receipts | Record payments (with "Pay full balance"), confirm them, and print a receipt in one of two formats: **A4 official** or **compact slip** (80 mm). |
| Staff & access | Admin-only list of staff accounts with roles. There is no public sign-up. |

### How receipts work out amounts

Every receipt shows the total price, this payment, the total paid to date and the balance.
The amount paid is subtracted from the total. Once the total has been paid, the receipt is
marked **PAID IN FULL** with the total price. Pending payments print with a
"PROVISIONAL" watermark until accounts confirm them.

## Role-based access

Only staff accounts created by an administrator can sign in. Suggested setup:

| Role | Can do | Suggested people |
| --- | --- | --- |
| Administrator | Everything, including staff accounts and deleting properties | Owner |
| Manager | Properties, subscribers, offers, confirm payments, receipts | Mr Nathan |
| Accounts | Record / confirm payments, issue receipts | Sharon |
| Agent | Register subscribers, create offers, log pending payments | Agent(s) |

Roles are set in `lib/roles.ts`. The UI hides what a role cannot use, but **the API must
enforce the same rules**. Never rely on the frontend alone.

## API contract

Implemented in `server/` (Express + MongoDB). For production: `npm run build && npm start`.

All requests send `Authorization: Bearer <accessToken>`. A `401` signs the user out.

| Method & path | Purpose |
| --- | --- |
| `POST /auth/login` | `{ email, password }` → `{ accessToken }` |
| `GET /auth/me` | Current user `{ name, email, role, active }` |
| `POST /auth/logout` | Optional |
| `GET /dashboard` | `{ properties, units, available, sold, collected, outstanding, recentProperties }` |
| `GET/POST /properties`, `PATCH/DELETE /properties/:id` | Properties with embedded `units` |
| `GET/POST /buyers` | Subscribers (`fullName, phone, email, address, occupation, nextOfKin, nextOfKinPhone`) |
| `GET/POST /offers` | Offers (`buyer, property, unit, agreedPrice, paymentPlan, initialDeposit, installmentMonths, validUntil, specialTerms, notes`). Creating one should reserve the unit. |
| `GET/POST /payments`, `PATCH /payments/:id/confirm` | Payments. Confirming should assign a `receiptNumber` and mark the unit `SOLD` once fully paid. |
| `GET/POST /users`, `PATCH /users/:id` | ADMIN only. `{ name, email, password, role }`, patch `role` / `active`. |
