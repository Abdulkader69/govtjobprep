# ১১–২০ গ্রেড নিয়োগ পরীক্ষা — MCQ practice app

Mobile-first MCQ practice for Bangladeshi government job exams, grades 11–20.
Bangla, English, Math and General Knowledge, with per-question explanations.

Grades in the browser with no backend. Accounts are Firebase (email/password,
optionally phone OTP), and one account can be logged in on only one device at
a time. Deploys to Vercel's free plan and Firebase's free plan as-is.

## Quick start

Needs Node 18 or newer (Vite 5 and Vitest 2 both require it).

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

That compiles `content/` into the runtime bank and starts Vite. No backend
needed — the default `local` mode grades in the browser.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Compiles the bank, then starts Vite (proxies `/api` to `localhost:8000`) |
| `npm run bank` | Compiles `content/` → `src/data/question-bank.json` (full) and `question-bank.guest.json` (the 500 guests see) |
| `npm run bank:upload` | Rebuilds, then pushes the full bank to Firestore (`bank/`), signing in as an admin |
| `npm run seo` | Writes `public/sitemap.xml` and `robots.txt` from `VITE_SITE_URL` (runs in prebuild) |
| `npm run pages` | Splits a scanned PDF into one 300 dpi image per page |
| `npm run import` | Turns transcribed questions into a `draft` shard |
| `npm run validate` | Structural checks on the bank; exits non-zero on error |
| `npm test` | Assembly, scoring and API round-trip tests |
| `npm run test:watch` | The same suite in watch mode |
| `npm run build` | Validates, compiles the bank, then builds into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |

Run `npm run validate` in CI and as a pre-commit hook. A malformed question is
invisible until a candidate hits it mid-exam.

## Configuration

Build-time variables in `.env` (copy `.env.example`):

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_MODE` | `local` | `local` grades in the browser, `http` grades on the server |
| `VITE_API_BASE` | `/api` | Where the `http` adapter sends requests |
| `VITE_AUTH_MODE` | `firebase` | `firebase` uses Firebase Auth + Firestore; `local` trusts the browser (no device limit) |
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | — | From Firebase console → Project settings → Your apps. Public identifiers; if unset the app falls back to `local` sign-in |
| `VITE_PHONE_LOGIN` | `false` | Show the phone-OTP login. Needs Firebase's Blaze plan; leave off on Spark |
| `VITE_SESSION_POLICY` | `replace` | `replace`: a new device signs the old one out. `block`: the new device is refused while the old is signed in |
| `VITE_SESSION_TTL_DAYS` | `30` | Under `block`, how old a session may be before a new device may take over |
| `VITE_SITE_URL` | — | Deployed origin, no trailing slash. Baked into canonical/Open Graph URLs, the sitemap and robots.txt |
| `VITE_ADMIN_MESSENGER` | — | `https://m.me/<name>`; shows the "message the admin" strip to free accounts. Empty hides it |
| `VITE_BANK_SOURCE` | `firestore` | Where unlocked accounts get the full bank. `bundle` imports the JSON into the build — development only, it makes every question public |

The guest cap (500) lives in [`src/lib/access.js`](src/lib/access.js).

## Accounts: one account, one device

**Identity** is Firebase Auth. Three ways in: **Google** (one button, on
both pages — the first sign-in registers), or **a mobile number or an email**
with a password — the register page has a tab for each, and whichever one the
person chooses is what they log in with. Many candidates have no email; those who do get
password-reset links. The other field is optional profile info. Neither is
verified: the free plan has no SMS, so a number is an identifier, not proof
of ownership.

Under the hood Firebase's password sign-in needs an email, so a phone account
is created as `01748114144@phone.prostuti.invalid`
([`src/lib/identity.js`](src/lib/identity.js)). `.invalid` is a reserved
domain that can never receive mail; the user never sees it. Accounts that
registered with a real email before this change still log in with it.

**Forgotten passwords.** Firebase can only mail a reset link to the identity
address, which for a phone account is undeliverable, so the app says
"contact the admin" (an email given as optional info does not help — it is
not the identity). The admin fix is Firebase console → Authentication →
Users → that number → **Delete**; the candidate registers again with the same
number (exam history is per-browser, so nothing is lost; re-grant `plan` if
they had it). Accounts whose identity is a real email get the normal reset
link.

With `VITE_PHONE_LOGIN=true` (Blaze plan) an OTP tab appears too; note an
OTP sign-in creates a *separate* Firebase user from a password account on the
same number.

**The one-device rule** is ours, on top of Firebase, which would happily keep
an account signed in everywhere. Firestore holds one document per account,
`sessions/{uid}`, containing a `deviceId` — a random id each browser keeps in
`localStorage`. A login writes this device's id there. Every signed-in tab
watches the document in real time (`onSnapshot`), and the moment the id is not
its own it signs itself out and the login page says why. There is no polling
and no server code: Firestore pushes the change to the old device within a
second or two. `VITE_SESSION_POLICY=block` makes a login refuse instead when
another device holds the account.

**Who sees the full bank.** `users/{uid}.plan === "full"`, or an admin.
Nothing else — there is no phone allowlist. `plan` and `disabled` can only
be written by a super admin; [`firestore.rules`](firestore.rules) forbids a
user from touching them on their own profile.

**Where the questions are.** Two banks come out of `npm run bank`:

| File | Who | Where it lives |
|---|---|---|
| `question-bank.guest.json` | signed-out visitors and `plan: "guest"` accounts | inside the app bundle — public |
| `question-bank.json` | `plan: "full"` accounts and admins | Firestore `bank/` collection, uploaded with `npm run bank:upload` — never in the bundle |

The production build contains only the guest file; `dist/` holds no id or
stem of a private question. Unlocked accounts fetch `bank/meta` and the
`bank/chunk-N` documents (~250 questions each), and the rules answer
permission-denied to anyone whose profile is not `plan: "full"`. The fetched
bank is cached in `localStorage` by version and wiped on sign-out.

After editing `content/`, run `npm run bank:upload` to publish the private
half; the guest half ships with the next deploy. Uploading asks for an admin
email and password (or reads `FIREBASE_ADMIN_EMAIL` / `FIREBASE_ADMIN_PASSWORD`)
and uses the normal web SDK — no service account needed.

**Super admin.** An admin is any uid with a document in the `admins`
collection. Nothing in the app can create one; you do it once from the
console:

1. Register in the app, then copy the account's uid from the Firebase console:
   Authentication → Users → the "User UID" column.
2. Firebase console → Firestore → **Start collection** → id `admins` →
   document id = that account ID → add any field (e.g. `role` = `"super"`)
   → Save.

Reload the app: an **অ্যাডমিন** button appears in the header. `/admin` has
three tabs:

- **সারসংক্ষেপ** — warnings that need action (bank in the app and in
  Firestore out of step, a chunk near Firestore's 1 MiB document limit,
  estimated usage past 80% of the free tier, orphaned sessions), headline
  counts, Firestore usage meters, the running configuration, and links into
  the Firebase console. Usage is *estimated* from what the client can see —
  the web SDK cannot read Firestore's counters — so the console's Usage page
  is the source of truth.
- **ব্যবহারকারী** — every account, searchable and filterable (full / guest /
  signed-in / disabled / admin), showing who is signed in on which device.
  Per user: unlock or lock the full bank, sign their device out (their tab
  signs out within seconds), disable or enable, rename, copy uid, delete the
  profile (after deleting the account in Authentication → Users). Orphaned
  sessions from deleted accounts are listed for cleanup.
- **প্রশ্নব্যাংক** — totals, guest vs private split per subject, difficulty and
  status, per-topic counts, each Firestore chunk's size, and the content
  version deployed vs uploaded. The version is a hash of the questions
  (`meta.version`), so rebuilding without changing content never triggers
  the "out of step" warning.

Disabling is enforced by the app when it next reads the profile; to block an
account at the Firebase level as well, use Authentication → Users → Disable.
The rules make every admin write admin-only, so the page's redirect for
non-admins is cosmetic. The pure calculations live in
[`src/lib/adminStats.js`](src/lib/adminStats.js), with tests.

**What this does not do.** The one-device check runs in the user's browser,
so a determined user could edit the JavaScript to ignore it. What they cannot
do is read the private bank without a `plan: "full"` profile — that refusal
comes from Firestore. And once an unlocked account has fetched the bank, the
answer key is in that browser (grading is client-side); that is the same
trust level as before, now limited to accounts you have chosen to unlock.

## The two API modes

`VITE_API_MODE=local` grades in the browser. Development and demo only — it
ships the whole bank, answers included, so the key is readable from devtools.

`VITE_API_MODE=http` grades on the server. Use this for anything real. See
[`docs/api-contract.md`](docs/api-contract.md) for the endpoint shapes and
[`docs/deployment.md`](docs/deployment.md) for where to run it.

Components never call `fetch` directly. They go through `src/api/index.js`, so
switching modes touches no UI code.

## Layout

```
content/         authored questions — the source of truth
├── exam-profiles.json           per-band rules: count, minutes, negative mark, mix
├── topic-blueprint.json         per-topic weights + the 50-per-topic depth goal
└── questions/<subject>/<set>.json

scripts/
├── build-bank.mjs               content/ → src/data/question-bank.json
└── validate-bank.mjs            structural checks; run this in CI

docs/            api contract, content authoring, deployment
public/          static assets served as-is
firestore.rules  who may read/write users/{uid} and sessions/{uid}

src/
├── data/        question-bank.json — GENERATED by npm run bank, never edit
├── api/         exam adapters (local, http) and auth adapters (firebase, local)
├── lib/         paper assembly, scoring, countdown, attempt state
├── components/  site header/footer, OMR options, exam bar, grid, confirm dialog
└── pages/       Home, Login, Register, Profile, ExamSetup, Demo, PrepRoom, Exam, Result, Review

Browser-side stores live in `src/lib/`: `history.js` (attempts), `bookmarks.js`
(saved questions), and the live attempt inside `src/api/local.js`.
```

## Documentation

| Document | Read it when |
|---|---|
| [`docs/content-authoring.md`](docs/content-authoring.md) | Adding or importing questions — shard format, the three rules that are easy to get wrong |
| [`docs/api-contract.md`](docs/api-contract.md) | Building the Laravel backend — four endpoints, six rules the server must enforce |
| [`docs/deployment.md`](docs/deployment.md) | Choosing where to host, and the pre-launch checklist |

## Design decisions worth keeping

**The paper blueprint is data, not code.** `content/topic-blueprint.json` holds
the per-topic weights for each subject — the published shape of the real exam.
Weights are relative, so one blueprint serves every band: 25 Bangla questions
split 2/2/2/1/3/2/3/3/2/5, and the same file scales to 20 without editing. Topic
quota is the stronger constraint; difficulty is applied within each topic, where
it degrades gracefully when a topic is owed only one or two questions.

**An exam survives a reload.** The `local` adapter mirrors the live attempt to
storage and `resumeAttempt` hands it back, because restoring the UI alone would
not be enough — grading runs against the adapter's in-memory map, so a reload
would otherwise leave a visible exam that could not be submitted. An attempt
whose clock ran out while the tab was closed comes back marked expired and is
submitted rather than discarded.

**History lives in the browser, and is stored compactly on purpose.**
`src/lib/history.js` records each finished attempt as question *ids* plus
per-topic tallies — never stems or options, which the bank already holds.
Duplicating them would exhaust the localStorage quota after a few dozen papers,
at which point writes fail silently and the history simply stops updating. The
list is capped at 300 attempts for the same reason, and the profile page offers
a JSON export because a cleared cache would otherwise take a term of study
with it.

**Access is tiered, and the tier is not a security boundary.** A signed-out
visitor sees a stable 500-question subset, drawn proportionally per topic so
every band can still fill a paper; an approved phone number in
[`src/lib/access.js`](src/lib/access.js) unlocks the full bank. In `local` mode
the whole bank and the allowlist are both in the browser bundle, so this is
convenience only — the server has to own it for real. See
[`docs/api-contract.md`](docs/api-contract.md).

**Revision and examination use different endpoints.** The preparation room
(`/prepare`) shows answers and explanations on purpose; `startAttempt` strips
them. Keeping these apart is what stops an exam being graded against a payload
the candidate could have read.

**One bank, every grade band.** Each question carries `grade_bands`, and each
band has a profile with its own question count, time, negative mark, difficulty
mix and pass percentage. Don't fork the bank per band.

**Options are permuted per attempt.** Hand-authored banks put the correct option
first far more often than chance — this one did it in all 100 original
questions, so a candidate who noticed could score full marks without reading a
stem. `buildPaper` permutes every question's options and moves the answer index
with them, which makes the position of the key meaningless no matter how the
content is written. The permutation is stored with the attempt and stripped from
the payload sent to the browser.

**The difficulty mix is enforced, not decorative.** A profile's `difficulty_mix`
splits each subject's allocation across easy/medium/hard. When a bucket runs dry
the assembler backfills from the nearest difficulty rather than serving a short
paper, and `supply()` reports the distortion so it stays visible.

**Questions have a lifecycle.** `status` (`draft`/`reviewed`/`retired`) keeps
unverified bulk imports out of live papers. `expires_at` handles facts with a
shelf life — office holders, "current" anything — which are wrong *later* rather
than wrong now, and so are never caught by review.

**The countdown is derived, not decremented.** `useCountdown` computes remaining
seconds from a fixed deadline on every tick and recomputes on
`visibilitychange`. Counting down by one per second looks identical in testing
but silently grants extra minutes when a phone sleeps or a tab is backgrounded.

**Answers save optimistically with a retry queue.** `useAttempt` holds answers
in state immediately and pushes them in the background, retrying on reconnect.
A candidate on a flaky connection who loses their answers does not come back.

**Tapping a selected option clears it.** With negative marking, a blank is often
the better choice, so the UI has to allow one.

**The band picker shows real availability, not the target.** If the bank cannot
fill a band's paper, it says so instead of quietly serving a short one.

## State of the bank

200 questions. All three bands now fill their papers:

| Band | Paper | Difficulty mix served |
|---|---|---|
| 11–12 | 100/100 | close to target |
| 13–16 | 80/80 | exactly on target |
| 17–20 | 70/70 | short on hard questions only |

`npm run validate` prints the live shortfall per band, subject and difficulty —
trust it over this table, which will drift.

Adding questions: [`docs/content-authoring.md`](docs/content-authoring.md).
Past papers from real circulars are the highest-value source, since repetition
across those exams is very high.

## Known gaps

What this does not do today, in case you are weighing it up:

- **Phone OTP is off on the free plan.** Firebase requires Blaze (billing
  attached, pay per SMS, first 10/day free) for phone sign-in. Email/password
  is free and is what ships. Flip `VITE_PHONE_LOGIN=true` after upgrading;
  the UI and adapter are already there.
- **The device rule is enforced in the browser.** See "Accounts" above.
  Adequate against casual account sharing; not against someone editing the
  bundle. The private bank, by contrast, is protected server-side.
- **History is per-browser.** Results are not synced across devices, and
  clearing site data clears them. Export from the profile page to keep a copy.
- **The 17–20 band is short on hard questions.** Every band fills its paper, but
  that one backfills its hard slots from easier ones.
- **Bulk import is manual by design.** Scanned papers cannot be OCR'd reliably
  in Bengali, so transcription needs a vision model and every answer key needs
  a human check. See [`docs/content-authoring.md`](docs/content-authoring.md).

## Roadmap

Roughly in order. Each step is worth doing before the one after it.

1. **Survive a refresh.** Persist the attempt and answers to IndexedDB, then
   make the app a PWA. The countdown already tolerates a sleeping phone and the
   save queue already tolerates a dropped connection — this is the last hole in
   that story, and the most user-visible thing left.
2. **Generalise the assembler.** Extend it from subject weights plus difficulty
   mix to topic spread and exclude-recently-seen. That last constraint is what
   turns one bank into unlimited practice sessions.
3. **Build the backend.** Accounts, attempt history, and server-side grading per
   [`docs/api-contract.md`](docs/api-contract.md). Recording `ms_spent` per
   answer is what later lets you re-derive `difficulty` from real success rates
   instead of tagging it by hand.
4. **Retention.** `weakTopics` is the seed of a spaced-repetition system. Topic
   mastery per user plus a drill mode is what makes this a daily habit rather
   than a one-off model test.

Worth starting now, because each gets harder later: JSDoc with `checkJs` for
types, Playwright for the three flows that are hard to reason about (timer
expiry, refresh-resume, offline answering), extracting the inline Bangla strings
for i18n, and a CI job running `npm run validate && npm test`.

## Deployment

Both halves are free-tier.

**Firebase (Spark, free)**

1. console.firebase.google.com → Add project. Analytics off is fine.
2. Build → Authentication → Get started → Sign-in method → enable
   **Email/Password**, then add **Google** (Add new provider → Google → Enable
   → pick a support email → Save). Google sign-in uses a popup; the redirect
   flow is avoided because browsers that partition third-party storage break
   it.
3. Build → Firestore Database → Create → production mode → a region near
   Bangladesh (`asia-south1` Mumbai).
4. Firestore → Rules → paste [`firestore.rules`](firestore.rules) → Publish.
   Then make yourself an admin (see "Accounts") and run `npm run bank:upload`.
5. Project settings → Your apps → Web (`</>`) → register → copy the four
   values into `.env` as `VITE_FIREBASE_*`.
6. Authentication → Settings → Authorized domains → add your Vercel domain
   (`*.vercel.app` is not accepted; add the exact hostname).

**Vercel (Hobby, free)**

1. Push to GitHub, import the repo at vercel.com. Vite is auto-detected;
   `vercel.json` adds the SPA rewrite.
2. Settings → Environment Variables → add the same `VITE_*` values as `.env`,
   with `VITE_SITE_URL` set to the Vercel URL (e.g. `https://bd-job-exam.vercel.app`).
   They are baked in at build time, so redeploy after changing them.
3. Deploy. `npm run build` validates the bank, compiles it and emits `dist/`.

**Licence check before charging for this.** Vercel's Hobby plan is for
personal, non-commercial use only. If candidates pay to use the app, move to
Vercel Pro, or to Cloudflare Pages, whose free tier has no such restriction
(and better latency into Bangladesh). Firebase Spark has no such clause.

If you later move grading to a server, the exam API is the part that needs
thought. **Laravel on Vercel works only through a
community PHP runtime on serverless functions**, where it fights a read-only
filesystem, no queue workers, no scheduler, and a cold start per invocation.
That last one is the problem: a multi-second boot when a candidate taps
পরীক্ষা শুরু করুন feels broken on a cheap phone. It costs them no exam time —
the server sets `expiresAt` — but it is the wrong first impression.

Prefer something always-on. At this scale SQLite on one small VM beats every
managed option on cost and latency. Options, trade-offs and the pre-launch
checklist are in [`docs/deployment.md`](docs/deployment.md).

## Fonts

The app uses the device's system Bengali font, which is why it loads instantly.
If you self-host Noto Sans Bengali instead, subset it with `fonttools`, serve
woff2 and set `font-display: swap`. Measure both on a real 3G connection before
deciding — a large share of users are on cheap Android phones.
