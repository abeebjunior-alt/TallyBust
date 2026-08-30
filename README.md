# TallyBust

Scan Your Stock. Track Every Sale. Know What Remains.

A universal stock-management app (pharmacies, retail, supermarkets, warehouses) built with React + Vite, backed by Supabase.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard and create a new project.
2. Once it's provisioned, open **SQL Editor → New query**, paste in the entire contents of `supabase/schema.sql`, and run it. This creates the `settings`, `products`, and `stock_history` tables with Row Level Security already switched on, so each account only ever sees its own data,
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Configure the app locally

```bash
cp .env.example .env
```

Paste your Project URL and anon key into `.env`.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). Create an account on the sign-up screen — that becomes your business owner login. Supabase sends a confirmation email by default; you can turn that off for testing under **Authentication → Providers → Email → Confirm email**.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "TallyBust: initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/tallybust.git
git push -u origin main
```

Your `.env` is already in `.gitignore`, so your Supabase keys won't be committed — the anon key is safe to expose client-side anyway (that's what Row Level Security is for), but keeping it out of git is still good hygiene.

## 4. Deploy (Vercel — easiest path)

1. Go to https://vercel.com, sign in with GitHub, and **Import Project** → pick your `tallybust` repo.
2. Vercel auto-detects Vite. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Every push to `main` will auto-redeploy.

Netlify works the same way if you'd rather use that: same env vars, build command `npm run build`, publish directory `dist`.

## 5. Putting codes on physical items so the camera recognises them

There are two pieces to this — assigning a code, and printing it onto the item:

1. **Every product already has a code — its SKU.** When you add a product, give it a code in the `TB-000000` pattern (or reuse an existing barcode number if the item already has one printed on its packaging, e.g. `6009123456789`). This SKU is what the camera looks up against.
2. **Print stickers from the Labels tab.** Once products exist, open **Labels** in the app, select the ones you want, and hit **Print**. Each label is a QR code containing that product's SKU, plus the name and SKU as text underneath. Print on sticker paper (or regular paper + tape/glue for a first batch) and stick one on each item.
3. **Scan to recognise them.** In the Scan modal, tap **Use Camera** — it asks for camera permission, then reads the QR/barcode live. The moment it decodes a code, it looks that code up against your products' SKUs:
   - **Match found** → that product is auto-selected, ready for you to enter a quantity and confirm.
   - **No match** → you're prompted to add it as a new product with that code pre-filled, so scanning the same sticker again next time will recognise it.
4. **Already-barcoded goods** (drinks, packaged food, anything with a manufacturer barcode) don't need a TallyBust sticker at all — scan the existing barcode once, add it as a new product, and from then on that barcode is the item's permanent code.

A couple of things worth knowing:
- Camera access only works over **HTTPS** (or `localhost` while developing) — this is a browser security rule, not a TallyBust one. Your Vercel/Netlify deployment is HTTPS by default, so this isn't something you need to configure.
- The scanner reads QR codes and most common 1D barcodes (EAN-13, UPC-A, Code128, etc.), so it works whether the code on the item is one you printed or one the manufacturer printed.

## 6. After launch

- **Add products**: once logged in, use "Add Product" on the Inventory tab, or bulk-insert rows directly in the Supabase Table Editor.
- **Staff logins**: right now everyone shares one owner login and just picks their name from the Staff tab so transactions stay attributed. If you want separate logins per staff member sharing one business's data, that's a small schema change (a `business_id` + membership table) — worth doing once you have real staff using it; see the note at the bottom of `supabase/schema.sql`.
- **Custom domain**: add it under your Vercel/Netlify project settings once you're ready.

## Project structure

```
tallybust/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── supabase/
│   └── schema.sql        ← run this in Supabase's SQL Editor
└── src/
    ├── main.jsx
    ├── App.jsx            ← the whole app: dashboard, scan, inventory, sales, reports, staff, settings
    ├── Login.jsx           ← email/password auth screen
    └── supabaseClient.js   ← Supabase client, reads keys from .env
```
