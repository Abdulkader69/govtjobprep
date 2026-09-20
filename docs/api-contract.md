# API contract

The React app talks only to `src/api/index.js`. Switching `VITE_API_MODE` from
`local` to `http` points it at these four endpoints. Implement them in Laravel
and no component changes.

## Rules the server must enforce

1. **Never send `answer` or `explanation` before submission.** The browser is
   not trustworthy. `GET /attempts` returns stems and options only.
2. **The server owns the clock.** `expires_at` is written when the attempt is
   created. The client countdown is display only.
3. **Reject late writes.** Any answer arriving after `expires_at` is discarded.
4. **Finalise abandoned attempts.** If someone closes their laptop mid-exam, no
   JavaScript runs. Either a scheduled job sweeps attempts past `expires_at`, or
   finalise lazily the next time the attempt is read. Lazy is usually enough.
5. **Permute the options per attempt, and store the permutation.** The bank is
   hand-authored and skews heavily towards putting the correct option first — in
   the original Set A it was first in all 100 questions. Shuffle each question's
   options when the attempt is created, save the order on the attempt, and
   return the shuffled order to the client. Storing it is what lets the review
   screen replay exactly what the candidate saw. Never send the permutation
   itself before submission: it *is* the answer key.
6. **Only serve questions that are `reviewed` and unexpired.** `status` keeps
   unverified imports out of live papers; `expires_at` retires facts with a
   shelf life. Filter on both when assembling a paper.

---

## `GET /api/exam-profiles`

```json
[
  {
    "grade_band": "13-16",
    "questions": 80,
    "minutes": 60,
    "negative_mark": 0.25,
    "pass_percent": 50,
    "subject_weights": { "bangla": 20, "english": 20, "math": 20, "gk": 20 },
    "supply": { "target": 80, "actual": 80, "short": false }
  }
]
```

`supply` is what the band picker displays. Compute it from the live bank so the
candidate is told the real question count, never the target.

## `GET /api/topics`

The taxonomy the exam-setup dropdowns are built from. Serve it from the same
blueprint the paper assembler uses, so the two cannot drift.

```json
{
  "bangla": ["সন্ধি", "সমাস", "কারক ও বিভক্তি", "..."],
  "english": ["Parts of speech", "Right form of verbs", "..."]
}
```

## Access tiers

A signed-out visitor may reach a capped subset of the bank; an approved phone
number unlocks all of it. The frontend implements this in `src/lib/access.js`,
but **that copy is a convenience, not a control**: in `local` mode the whole
bank and the allowlist both ship to the browser.

When you build the server, enforce the cap there and derive it from **session
state, never from a flag the client sends**. A request that says
`unlocked=true` proves nothing. The cap should apply to `/study`, `/topics`,
`/stats` and attempt creation alike, or a candidate can simply start an exam to
read questions the study endpoint withheld.

Keep the guest subset **stable per user**. If it is re-rolled each request, a
visitor who reloads enough times sees the whole bank and the cap means nothing.

## Accounts

Accounts are **not** part of this contract: they live in Firebase Auth, and
the one-device-per-account rule lives in a Firestore document (see the
README, "Accounts"). A Laravel backend that implements the endpoints below
should verify the Firebase ID token the client sends (`Authorization: Bearer
<idToken>`, via the Firebase Admin SDK or Google's public JWKS) and read
`users/{uid}.plan` to decide the access tier — never a flag from the client.
If it also reads `sessions/{uid}.deviceId` and compares it to an
`X-Device-Id` header, the device rule becomes tamper-proof, because the bank
is then only served to the device that holds the session.

## `GET /api/study`

Revision content for the preparation room. Query: `subject`, `topic`,
`subtopic`, `band` — all optional.

**This endpoint returns `answer` and `explanation` by design.** That is the
opposite of the attempt flow, and the two must stay on separate endpoints: an
exam must never be graded against a payload the candidate could have fetched.
Apply the same `status` / `expires_at` filter as the assembler, so revision
never teaches a retired or unverified question.

## `POST /api/attempts`

```json
{
  "grade_band": "13-16",
  "shuffle": true,
  "count": 40,
  "subjects": ["math"],
  "topics": ["শতকরা", "লাভ-ক্ষতি"]
}
```

`count`, `subjects` and `topics` are optional. `count` omitted means the band's
full paper; `subjects`/`topics` omitted means all four subjects in blueprint
proportions.

**Clamp `count` server-side** to what the band can actually supply, and
recompute `minutes` from it — never accept a duration from the client. The
frontend mirrors this in `resizeProfile`, but that copy is for display only.

A topic-restricted paper has no subject shape to honour: draw the whole paper
from the filtered pool. If the filter yields fewer questions than asked, serve
the short paper rather than padding it from topics the candidate did not pick.

```json
{
  "attemptId": 8134,
  "expiresAt": 1757840400000,
  "profile": { "negative_mark": 0.25, "pass_percent": 50, "minutes": 60 },
  "questions": [
    {
      "id": "bn-somas-003",
      "subject": "bangla",
      "topic": "সমাস",
      "difficulty": "medium",
      "stem": "‘চৌরাস্তা’ কোন সমাসের উদাহরণ?",
      "options": ["দ্বিগু", "দ্বন্দ্ব", "বহুব্রীহি", "অব্যয়ীভাব"]
    }
  ]
}
```

`expiresAt` is epoch milliseconds. Send it as a timestamp, not a duration, or a
client with a skewed clock gets the wrong deadline.

## `GET /api/attempts/current`

The attempt still in progress for this session, or `null`. This is what lets a
candidate reload mid-exam without losing the paper.

```json
{
  "attempt": { "attemptId": 8134, "expiresAt": 1757840400000, "profile": {}, "questions": [] },
  "answers": { "bn-somas-003": 0 },
  "expired": false
}
```

Return an attempt whose `expires_at` has passed rather than hiding it, with
`expired: true` — the client submits it, so time that ran out while the tab was
closed is graded honestly instead of the attempt silently disappearing. The
restored `questions` must still be stripped of `answer` and `option_order`, and
must preserve the original option order for that attempt.

`DELETE /api/attempts/current` abandons it without grading.

## `PUT /api/attempts/{id}/answers/{questionId}`

Request: `{ "option": 2 }` — or `{ "option": null }` to clear it, which matters
when negative marking makes a blank safer than a guess.

Response: `{ "accepted": true }` or `{ "accepted": false, "reason": "expired" }`.

Upsert one row per answer. Store the response time too: after a few hundred
attempts you can compute each question's real success rate and re-tag
`difficulty` from data instead of by hand.

## `POST /api/attempts/{id}/submit`

Request: `{ "auto": true }` when the timer expired, `false` when the candidate
tapped submit. Idempotent — a retry after a dropped connection must not create a
second result.

```json
{
  "auto": false,
  "result": {
    "total": 80, "correct": 52, "wrong": 18, "blank": 10,
    "penalty": 4.5, "score": 47.5, "passMark": 40, "passed": true
  },
  "answers": { "bn-somas-003": 0 },
  "questions": [ { "...": "now including answer and explanation" } ]
}
```

Grade with the same rules as `src/lib/scoring.js`: a blank is never penalised,
and the score floors at zero rather than going negative.

## Suggested tables

| Table | Purpose |
|---|---|
| `questions` | stem, options (JSON), answer index, explanation, subject, topic, subtopic, difficulty, grade_bands (JSON), status, expires_at, exam (JSON: name + year) |
| `exam_profiles` | one row per band — keep these in the database, the grade 11-20 mark rules are being rewritten |
| `attempts` | user, grade_band, started_at, expires_at, submitted_at, auto_submitted, score |
| `attempt_answers` | attempt, question, option, responded_at, ms_spent |
| `exam_question` | pin a fixed paper to an attempt — question, position, **option_order** — so neither a bank edit nor a reshuffle changes a past result |

That last table matters more than it looks. If you assemble the paper on the
fly and later fix a question, old results silently stop reproducing.
