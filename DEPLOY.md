# Deploying Sain Terra (free tier, for testing)

Three free services, set up in this order:

| Part | Service | Free plan limits worth knowing |
| --- | --- | --- |
| Database | MongoDB Atlas (M0) | 512 MB storage, no automatic backups |
| Backend API (`server/`) | Render (Free web service) | Sleeps after 15 min idle; first request after that takes about a minute |
| Website | Vercel (Hobby) | Fine for testing |

You need a GitHub account with access to `HauwaSalihu/sain-terra`. All three services can
sign in with GitHub. Keep a text file open to paste values into as you go.

The services deploy the repository's default branch (`main`), so merge the latest work into
`main` first.

---

## Step 1: Database (MongoDB Atlas)

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up.
2. When asked to deploy a cluster, choose **M0 (Free)**. Pick provider **AWS** and the
   region closest to you (e.g. *Europe – Ireland* or *Africa – Cape Town* if offered).
   Name it `sainterra` and click **Create Deployment**.
3. A "Connect to sainterra" box appears:
   - Under **Create a database user**, set username `sainterra-api` and click
     **Autogenerate Secure Password**. **Copy the password** into your text file.
   - Click **Create Database User**.
4. Click **Choose a connection method** → **Drivers**. Copy the connection string. It looks
   like:
   `mongodb+srv://sainterra-api:<db_password>@sainterra.abc123.mongodb.net/?retryWrites=true&w=majority&appName=sainterra`
5. In your text file, edit it:
   - Replace `<db_password>` with the password from step 3.
   - Add the database name `sainterra` right after `.mongodb.net/`:
     `mongodb+srv://sainterra-api:PASSWORD@sainterra.abc123.mongodb.net/sainterra?retryWrites=true&w=majority&appName=sainterra`

   This is your **MONGODB_URI**.
6. In the left menu open **Security → Network Access** → **Add IP Address** →
   **Allow Access from Anywhere** (`0.0.0.0/0`) → **Confirm**. Render's free plan has no
   fixed address, so this is needed. The database is still protected by the password.

---

## Step 2: Backend API (Render)

1. Make a secret key for logins. On your computer run:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output into your text file. This is your **JWT_SECRET**. Never share it.
2. Go to https://dashboard.render.com and sign up with GitHub.
3. Click **New +** → **Web Service** → **Build and deploy from a Git repository**. Connect
   GitHub if asked and select **HauwaSalihu/sain-terra**.
4. Fill in the form exactly:

   | Field | Value |
   | --- | --- |
   | Name | `sainterra-api` |
   | Region | closest to you (e.g. Frankfurt) |
   | Branch | `main` |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. Under **Environment Variables** add:

   | Key | Value |
   | --- | --- |
   | `MONGODB_URI` | your MONGODB_URI from step 1 |
   | `JWT_SECRET` | your JWT_SECRET from step 2.1 |
   | `JWT_EXPIRES_IN` | `12h` |
   | `CORS_ORIGIN` | `http://localhost:3000` (you will change this in step 3) |

6. Click **Create Web Service** and wait for **Live** (a few minutes).
7. Copy the address at the top, e.g. `https://sainterra-api.onrender.com`.
8. Check it: open `https://sainterra-api.onrender.com/api/health` in your browser. You should
   see `{"ok":true}`. Your **API URL** is that address plus `/api`:
   `https://sainterra-api.onrender.com/api`

---

## Step 3: Website (Vercel)

1. Go to https://vercel.com/signup and sign up with GitHub.
2. Click **Add New…** → **Project** → **Import** next to **sain-terra**.
3. Leave Framework Preset as **Next.js** and Root Directory as `./`.
4. Open **Environment Variables** and add:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | your API URL, e.g. `https://sainterra-api.onrender.com/api` |
   | `NEXT_PUBLIC_COMPANY_ADDRESS` | e.g. `Abuja, Federal Capital Territory, Nigeria` |
   | `NEXT_PUBLIC_COMPANY_PHONE` | optional |
   | `NEXT_PUBLIC_COMPANY_EMAIL` | optional |

5. Click **Deploy** and wait for the confetti. Copy the site address, e.g.
   `https://sain-terra.vercel.app`.
6. Add the site address for the QR codes: in the project go to **Settings → Environment
   Variables**, add `NEXT_PUBLIC_SITE_URL` = `https://sain-terra.vercel.app`, then
   **Deployments** → the latest one → **⋯** → **Redeploy**. (Any `NEXT_PUBLIC_` change
   needs a redeploy.)
7. Let the website talk to the API: in Render open **sainterra-api → Environment**, change
   `CORS_ORIGIN` to your site address (no slash at the end), e.g.
   `https://sain-terra.vercel.app`, and click **Save, rebuild, and deploy**.

   To allow your computer too, separate with a comma:
   `https://sain-terra.vercel.app,http://localhost:3000`

---

## Step 4: Create the CEO and COO accounts

Run this once from your computer. It writes straight to the Atlas database.

1. In the project's `server` folder create a file named `.env` containing:
   ```
   MONGODB_URI=your MONGODB_URI from step 1
   JWT_SECRET=your JWT_SECRET from step 2.1
   ```
2. Run:
   ```bash
   cd server
   npm install
   npm run create-admin -- "Iliya Nathan" ceo@yourcompany.com --title "MD/CEO"
   npm run create-admin -- "Stanley Amos" coo@yourcompany.com --title "COO"
   npm run create-admin -- "Your Name" you@yourcompany.com --role ADMIN
   ```
   Each command asks for a password. Use a strong one and give it to that person
   privately.

`.env` is ignored by git; never commit it.

---

## Step 5: Test it

1. Open your Vercel address. (If the API has been asleep, the first sign-in can take up to
   a minute.)
2. Sign in as the CEO → **My e-signature** → add the signature. Do the same as the COO.
3. Sign in as the admin → **Staff & access** → add Sharon (Accounts) and an agent.
4. Run through the flow: add a property → add a subscriber → create an offer letter → the
   CEO or COO approves it → record a payment → the COO e-signs, then the CEO e-signs →
   print the receipt → scan its QR code with a phone. It should open your site and show
   **Genuine receipt**.

## Updating later

Push or merge to `main`. Vercel and Render both redeploy automatically.

## Before going properly live

- **Database:** move off M0 to a paid tier (M10) for automatic backups, or schedule
  your own exports.
- **API:** Render's Starter plan (about $7/month) stops the API sleeping.
- **Domain:** add your own addresses (e.g. `portal.sainterra.com` in Vercel → Settings →
  Domains, `api.sainterra.com` in Render → Settings → Custom Domains), then update
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and `CORS_ORIGIN` to match and redeploy.
  QR codes on documents printed earlier keep pointing at the old address, so set the
  domain before printing real receipts.
- The demo buttons are hidden on deployed sites. Set `NEXT_PUBLIC_ENABLE_DEMO=true` in
  Vercel only if you want them on a test deployment.
