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

To put it online on free hosting (Vercel, Render, MongoDB Atlas), follow **[DEPLOY.md](DEPLOY.md)**.

You need [MongoDB](https://www.mongodb.com/try/download/community) (or a free MongoDB Atlas
database).

**1. Start the API** (in `server/`):

```bash
cd server
cp .env.example .env        # set MONGODB_URI and a long random JWT_SECRET
npm install
# Super administrators (CEO and COO): they e-sign receipts and approve offers.
npm run create-admin -- "Iliya Nathan" ceo@example.com --title "MD/CEO"
npm run create-admin -- "Stanley Amos" coo@example.com --title "COO"
# Optional: a regular administrator who manages records but cannot sign.
npm run create-admin -- "Your Name" you@example.com --role ADMIN
npm run dev                 # http://localhost:4000/api
```

**2. Start the website** (in the project root, a second terminal):

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                        # http://localhost:3000
```

Each super administrator signs in and adds their signature on **My e-signature** (draw it,
or upload a photo of the signature on plain white paper). Then add Sharon, the agents and
other staff on **Staff & access**.

Set `NEXT_PUBLIC_SITE_URL` to the live website address (e.g. `https://portal.sainterra.com`)
so the QR codes on documents point to it.

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
| Payments & receipts | Record payments (with "Pay full balance"); the CEO and COO each e-sign; print a receipt in one of two formats: **A4 official** or **compact slip** (80 mm). |
| E-signatures | Super administrators keep one signature on file. It is stamped onto documents with their name, title and the time they signed. |
| Verification | Every receipt and offer letter carries a unique QR code. Scanning it opens `/verify/<code>` and shows the real record, so fake or altered documents are easy to spot. |
| Staff & access | Admin-only list of staff accounts with roles. There is no public sign-up. |

### How receipts work out amounts

### Signing and verification

- **Receipts** need two e-signatures from two different super administrators (CEO and COO).
  The first to sign appears as **Received by**, the second as **Authorised by**, so the COO
  should sign first. Until both have signed the receipt is **PROVISIONAL**: it carries no
  signature images and does not count towards the balance.
- **Offer letters** are created as drafts and print with a DRAFT watermark until a super
  administrator clicks **Approve & e-sign**.
- Only super administrators can create or change super administrator accounts, so nobody
  else can grant themselves signing rights. Signatures are only ever served to signed-in
  staff; the public verification page shows who signed and when, never the images.

Every receipt shows the total price, this payment, the total paid to date and the balance.
The amount paid is subtracted from the total. Once the total has been paid, the receipt is
marked **PAID IN FULL** with the total price. Pending payments print with a
"PROVISIONAL" watermark until both the CEO and COO have e-signed them.

## Role-based access

Only staff accounts created by an administrator can sign in. Suggested setup:

| Role | Can do | Suggested people |
| --- | --- | --- |
| Super administrator | Everything, plus e-signing receipts and approving offer letters | Iliya Nathan (MD/CEO), Stanley Amos (COO) |
| Administrator | Records and staff accounts, deleting properties; cannot sign | Owner |
| Manager | Properties, subscribers, offers, record payments, print receipts | Sales manager |
| Accounts | Record payments, print receipts | Sharon |
| Agent | Register subscribers, create offers, log pending payments | Agent(s) |

Roles are set in `lib/roles.ts`, which both the website and the API use; the API enforces
them on every request.

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
| `GET/POST /payments`, `POST /payments/:id/authorize` | Payments. Super administrators e-sign; the second signature confirms it, assigns a `receiptNumber` and marks the unit `SOLD` once fully paid. |
| `POST /offers/:id/approve` | Super administrator approves a draft offer and e-signs it. |
| `PUT /auth/me/signature`, `GET /signatures/:id` | Set your own e-signature (PNG data URL); fetch one for printing (staff only). |
| `GET /verify/:code` | Public. What a scanned QR code shows; never includes signature images. |
| `GET/POST /users`, `PATCH /users/:id` | Admins. `{ name, email, password, role, title }`, patch `role` / `title` / `active`. Super administrator accounts only by a super administrator. |
