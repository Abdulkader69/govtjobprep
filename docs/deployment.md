# Where to host this

Two separate questions, and conflating them is what makes Laravel hosting look
harder than it is:

1. **Where do the questions live?** — see [`content-authoring.md`](content-authoring.md).
   Short version: git is the source of truth, the database is a derived copy.
2. **Where does the API run?** — this document.

## Can you deploy Laravel on Vercel?

Technically yes, practically no — not for this.

Vercel has no official PHP runtime. Laravel runs there only through the
community `vercel-php` runtime, on serverless functions, and Laravel assumes a
number of things that serverless functions do not provide:

| Laravel expects | Vercel gives you | What you have to do |
|---|---|---|
| A writable `storage/` | A read-only filesystem except `/tmp` | Repoint logs, cache, compiled views and sessions at `/tmp` — which is wiped between invocations |
| A session store on disk | Nothing persistent | Move sessions to cookies or an external store |
| Queue workers | No long-running processes | Drop queues, or run them somewhere else |
| A scheduler (`schedule:run`) | Cron on paid plans, HTTP-triggered | Rebuild the "finalise abandoned attempts" sweep as an HTTP endpoint |
| A warm process | A cold start per invocation | Accept the latency |

The last row is the one that matters for an exam app. When a candidate taps
**পরীক্ষা শুরু করুন**, a cold Laravel boot can take several seconds. It will not
cost them exam time — the server sets `expiresAt`, so the clock starts when the
attempt is created — but it feels broken on a slow phone, which is most of your
users.

Use Vercel for the **frontend**, which is exactly what it is good at. The build
output is static files.

## What actually works, cheapest first

**Frontend** — static, free, no caveats. Cloudflare Pages, Netlify or Vercel all
serve `dist/` fine. Cloudflare tends to have the best latency into Bangladesh.

**API** — pick by whether you can tolerate a cold start:

| Option | Free? | Cold starts | Notes |
|---|---|---|---|
| **Oracle Cloud Always Free** | Genuinely free, indefinitely | None — always on | An ARM VM you administer yourself. Best value, most work. |
| **Laravel Cloud** | Free/sandbox tier with limits | Minimal | Official Laravel PaaS. Smoothest path; check current tier limits before committing. |
| **Fly.io** | Small allowance, then cheap | None if you keep one machine warm | Docker + a volume for SQLite works well at this size. |
| **Render** | Free web service tier | Yes — spins down after ~15 min idle | The free tier's cold start is slow. Its free Postgres also expires; pair it with Neon or Supabase instead. |
| **Railway** | Trial credit, then usage-based | None | No longer a standing free tier. |
| **Vercel + `vercel-php`** | Free tier | Yes, every invocation | Listed for completeness. See above. |

**Database** — you do not need a big one. This app's write volume is one row per
answer. Free Postgres from **Neon** or **Supabase** is plenty; **Turso** if you
prefer SQLite. (PlanetScale removed its free tier in 2024.)

Honestly, at this scale SQLite on a single small always-on VM beats every
managed option on both cost and latency, and Laravel supports it out of the box.
Revisit when you have concurrent exam load worth sharding.

## Recommended shape

```
Cloudflare Pages  ──>  dist/            (static, free, fast in BD)
       │
       │ /api/*  →  proxy or CORS
       ▼
Small always-on VM  ──>  Laravel + SQLite (or Postgres on Neon)
```

Set `VITE_API_MODE=http` and `VITE_API_BASE` to the API origin at build time.
Everything else is already in place: components never call `fetch` directly, so
nothing in the UI changes.

## Before you go live

Non-negotiable, in rough order:

1. `VITE_API_MODE=http`. The `local` adapter ships the answer key to the
   browser — it exists for development and demos only.
2. Implement the four endpoints in [`api-contract.md`](api-contract.md), and the
   four rules at the top of that file. The server owns the clock and the key.
3. Permute options **server-side**, per attempt, and store the permutation with
   the attempt so a review screen can replay what the candidate saw. The
   frontend's `withPermutedOptions` shows the shape; see
   [`content-authoring.md`](content-authoring.md) for why it is not optional.
4. Pin the paper to the attempt (`exam_question` in the contract's table list),
   so editing a question later cannot change an old result.
5. Run `npm run validate` in CI. It exits non-zero on a malformed bank.
