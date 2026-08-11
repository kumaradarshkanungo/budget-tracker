# Budget Tracker

A mobile-friendly monthly budget tracker that mirrors your Excel sheet. Runs as a **static web app (no custom server)**. Data is cached locally and, when you sign in, **synced to your own Supabase account so you can access it on multiple devices**.

## Two ways to run

### A) Local-only (zero setup)
No accounts, no cloud. Data lives in this browser's localStorage. Use **Export/Import** to move between devices manually.

```bash
cd budget-tracker
npm install
npm run dev        # open the printed URL (e.g. http://localhost:5173)
```

If no Supabase keys are present, the app automatically runs in this mode.

### B) Multi-device sync (Supabase + Google sign-in)
You don't run a server — Supabase is the hosted backend. ~15 min one-time setup:

1. Create a free project at [supabase.com](https://supabase.com).
2. **Database:** open SQL editor → paste and run [`supabase-schema.sql`](./supabase-schema.sql). This creates the `budgets` table with Row-Level Security (each user sees only their own data).
3. **Google auth:** Dashboard → Authentication → Providers → enable **Google** (follow their prompt to create Google OAuth credentials, or use Supabase's quick setup). Add your site URL (and `http://localhost:5173` for dev) to Authentication → URL Configuration → Redirect URLs.
4. **Keys:** copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
   (from Dashboard → Project Settings → API). The anon key is safe to ship in a static site — RLS is what protects the data.
5. `npm run dev`. You'll get a Google sign-in screen; after signing in, your data syncs to the cloud.

### Build & host as a static site
```bash
npm run build      # outputs dist/
npm run preview    # preview the build locally
```
Deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages…). Set the two `VITE_SUPABASE_*` env vars in the host's build settings so sync works. Add your deployed URL to Supabase's redirect URLs.

Run tests:
```bash
npm test
```

## Sections (mirrors the spreadsheet)

- **Total Balance** — holdings → **Total Available** (sum).
- **Bank Balance** — per bank: **Required** (auto), **Actual** (input), **Extra = Actual − Required**.
  - Required = sum of **unpaid bills tagged to that bank**.
  - The **Primary** bank additionally includes the **remaining budget** (`Σ Budget − Σ Spend`) — this is added to the primary bank *only*.
- **Budget** — per category: **Spend** (input), **Budget** (input), **Left = Budget − Spend**, plus a Total row.
- **Bills & EMIs** — Date, Name, **Bank** (tag), Amount, **Paid**. Shows **Total**, **Amount Pending**, paid/total count.
- **Summary cards** — Total Available, Total Spend, Extra.
- **Date tracker** — **Start/End dates are the month's first and last day (derived, read-only)**; shows Days Left / Days Passed from today.

Negatives render in **red with parentheses**, e.g. `(541,836)`; Indian digit grouping.

## Months

Use **＋ Month** and pick a month with the month picker (month + year only). Start/End dates come automatically from that month. Each month is its own dataset; a new month copies your bank names + budget categories (amounts zeroed) and sets your **default bank** (from Settings) as primary.

## Settings

The **⚙ Settings** page lets you choose your **default / primary bank**, applied to newly created months. It's structured to hold more options later (currency, categories, reminders…).

## Note on the seeded numbers vs. your original

The app seeds August 2026 from your screenshot. With the agreed rule (primary bank Required = its unpaid bills + **full** remaining budget), IDFC Required = **570,069** (520,069 pending + 50,000 remaining budget). Your sheet showed **565,069** because the original formula added a *single* budget cell rather than the whole remaining budget. Adjust the budget figures to match, or tell me the exact cell to wire in.

## Where data lives

- **Local:** one `localStorage` key `budget-tracker-v1` (offline cache).
- **Cloud (if configured):** one JSON row per user in Supabase `budgets`, protected by RLS. Last write wins; on sign-in, the cloud copy is authoritative.
