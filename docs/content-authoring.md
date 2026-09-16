# Adding questions

The bank is the product. Everything else is a few hundred lines of React.

## Where questions live

Questions are authored in **shards** under `content/questions/<subject>/`, one
file per subject per source. `src/data/question-bank.json` is **generated** —
never edit it by hand, it is overwritten by every build.

```
content/
├── exam-profiles.json          per-band rules: count, minutes, negative mark, mix
└── questions/
    ├── bangla/set-a.json
    ├── bangla/set-b.json
    ├── english/…
    ├── math/…
    └── gk/…
```

```bash
npm run bank       # compile content/ → src/data/question-bank.json
npm run validate   # structural checks; exits non-zero on error
```

`npm run dev` compiles first, and `npm run build` compiles and validates first,
so in practice you edit a shard and refresh.

### Why shards rather than one file

One file stops being reviewable somewhere around a few hundred questions, and
two people adding questions in the same week will conflict on every commit. A
shard is small enough to read in a pull request. Add a new one whenever you
start a new source — `content/questions/gk/bpsc-2023.json` — rather than growing
an existing file forever.

## Shard format

```json
{
  "source": "Set B (original, past-paper pattern)",
  "defaults": { "subject": "bangla", "status": "reviewed", "expires_at": null },
  "questions": [
    {
      "id": "bn-sondhi-101",
      "topic": "সন্ধি",
      "difficulty": "hard",
      "grade_bands": ["11-12", "13-16"],
      "stem": "‘উদ্ধার’ শব্দের সঠিক সন্ধি বিচ্ছেদ কোনটি?",
      "options": ["উদ্ধ + আর", "উৎ + হার", "উদ + হার", "উৎ + ধার"],
      "answer": 1,
      "explanation": "‘ৎ’-এর পরে ‘হ’ থাকলে ‘ৎ’ স্থানে ‘দ্’ ও ‘হ’ স্থানে ‘ধ্’ হয়।"
    }
  ]
}
```

`defaults` is merged into every question in the file, so subject, status and
source are written once instead of per question. Anything on the question wins.

| Field | Notes |
|---|---|
| `id` | Unique across the whole bank. `<subject>-<topic>-<n>` reads well. |
| `difficulty` | `easy` \| `medium` \| `hard`. Drives the per-band mix — not decorative. |
| `grade_bands` | Which bands may draw this question. Hard questions usually omit `17-20`. |
| `answer` | Index into `options`. See the warning below. |
| `explanation` | Required. A wrong answer with no explanation teaches nothing. |
| `status` | `draft` \| `reviewed` \| `retired`. Only `reviewed` is served. |
| `expires_at` | ISO date or `null`. After it passes, the question stops being served. |
| `exam` | Optional `{ name, year }` — which real exam the question came from. Omit it for anything written in past-paper style. |

## Three rules that are easy to get wrong

**Do not always put the correct option first.** The original Set A did this in
all 100 questions, which meant a candidate could tap ক every time and score
full marks. The assembler now permutes options per attempt, so this can no
longer reach a candidate — but write them varied anyway. `npm run validate`
warns when the bank skews past 40% in one slot, and a printed paper generated
straight from the bank would expose the pattern.

**Import as `draft`.** `status` gates review. A bulk import lands as
`"status": "draft"`, stays out of every paper, and flips to `reviewed` once a
person has actually checked the answer. This is the only thing standing between
a typo in a spreadsheet and a wrong answer in a live exam.

**Only set `exam` when the question really came from that paper.** The field is
shown to candidates, so a guessed attribution is a false record — it tells
someone a question is a repeat when it is not. Anything written in past-paper
style should simply omit it; `npm run validate` prints how many questions carry
a real attribution and treats the rest as original rather than as missing data.

**Set `expires_at` on anything with a shelf life.** Office holders, budget
figures, "current" anything, administrative counts like the number of divisions.
These are not wrong today, so review will never catch them — they just quietly
become wrong. Give them a date:

```json
{ "stem": "বর্তমানে বাংলাদেশে বিভাগ কয়টি?", "expires_at": "2027-12-31T00:00:00Z" }
```

## Importing from scanned papers

Most official past papers are published as scans, so this is the path that
matters. The workflow:

```bash
npm run pages -- scans/bpsc-2023.pdf        # PDF → one 300 dpi PNG per page
#   … transcribe each page into a JSON array …
npm run import -- transcribed.json gk bpsc-2023 --exam "৪৪তম বিসিএস প্রিলিমিনারি" --year 2023
npm run bank && npm run validate
```

`import-draft.mjs` writes everything as `status: "draft"`, so nothing reaches a
candidate until a person flips the shard's `defaults.status` to `reviewed`.
That flip is the review step, and it is deliberately manual.

300 dpi is the floor. Below it the ু/ূ and ই/ঈ pairs stop being separable, and
those pairs *are* the question in a বানান or সন্ধি item.

### Do not use OCR for this

Tesseract with the Bengali pack is not accurate enough, and the way it fails is
worse than the rate suggests. Measured against ten known questions from this
bank, rendered clean at 300 dpi — a far easier input than any real scan:

| Model | Stems intact | Options intact | Questions usable as-is |
|---|---|---|---|
| `tessdata_fast` | 4/10 | 27/40 | 1/10 |
| `tessdata_best` | 7/10 | 20/40 | 2/10 |

Two failure modes make it unusable rather than merely tedious:

**It flattens the distinction the question is testing.** On `মুমূর্ষু` the four
options came back with two of them byte-identical, and on `শুশ্রূষা` all four
were wrong. A বানান question whose options OCR cannot tell apart is not a
question that needs correcting — it is gone. These topics are roughly a quarter
of every Bangla section.

**It corrupts digits silently.** `১২ দিনে` was read as `৩২ দিনে`, and `৪%` as
`8%`. The result is a question that looks completely valid and has the wrong
answer. Nothing downstream can detect it, and a reviewer working through a few
hundred imports will not catch every flipped digit. This is the failure that
would actually reach a candidate.

`import-draft.mjs` rejects a batch where any question has two identical options,
which catches the first mode. There is no automated defence against the second.

### Use a vision model instead

Modern multimodal models read Bengali script far more reliably than Tesseract —
including the conjuncts and matra distinctions above. Feed it the page image and
have it emit the JSON array `npm run import` expects.

Two rules regardless of which model does the transcription:

1. **A model can transcribe; it cannot verify the answer key.** Where the
   authority published an official key, check against that. Where it did not, a
   person who knows the subject has to confirm the answer before the shard flips
   to `reviewed`. Transcription accuracy and answer correctness are different
   problems.
2. **Keep the page image.** Record the paper and page in `source` so any
   question can be traced back and re-checked later.

Realistic throughput is 100–200 reviewed questions an hour once transcription is
automated. Getting to a couple of thousand verified questions is a few focused
days of review, not a scrape.

## What the bank needs next

`npm run validate` prints the live shortfall per band, per subject and per
difficulty. Fill what it names; do not guess. As of the last Set B import all
three bands fill their papers, and the remaining gap is hard questions for the
17–20 band.

Past papers from real circulars are by far the highest-value source: repetition
across these exams is very high, so a question that appeared once is likely to
appear again.

One caution worth stating plainly. Questions from actual past public exams are
generally fine to reuse. The **compiled guide books** that collect them —
Professor's, Oracle, MP3 and similar — are copyrighted works, and transcribing
them wholesale is infringement regardless of where the questions originally came
from. Work from the circulars and the original papers, and record where each
question came from in `source`.

## Seeding a database from this

When the Laravel backend exists, the shards stay the source of truth and the
database becomes a derived read model: a seeder reads the compiled
`question-bank.json` and upserts on `id`. That keeps one place to edit, keeps
review in pull requests where it belongs, and makes the database rebuildable
from scratch. Never let the two drift by editing questions in production.
