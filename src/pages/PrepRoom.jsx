import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import ExamTag from "@/components/ExamTag.jsx";
import { api } from "@/api";
import { SUBJECTS, SUBJECT_LABEL, DIFFICULTY_LABEL, letters, PREP_PER_PAGE } from "@/lib/constants.js";
import { bn } from "@/lib/bn.js";
import { GUEST_QUESTION_LIMIT } from "@/lib/access.js";
import { summarise } from "@/lib/history.js";
import { bookmarkSet } from "@/lib/bookmarks.js";
import BookmarkButton from "@/components/BookmarkButton.jsx";

/**
 * Revision, not examination: every question is shown with its key and
 * explanation. Filtered by subject, then topic, then subtopic where a subject
 * has them.
 */
export default function PrepRoom({ auth }) {
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") || "bangla";
  const topic = params.get("topic") || "";
  const subtopic = params.get("subtopic") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  // Drill mode: only the questions this browser has got wrong before.
  const wrongOnly = params.get("wrong") === "1";
  const savedOnly = params.get("saved") === "1";

  const [taxonomy, setTaxonomy] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(() => new Set());
  const [hideAnswers, setHideAnswers] = useState(false);

  useEffect(() => {
    api.topics({ unlocked: auth.unlocked }).then(setTaxonomy).catch(setError);
  }, [auth.unlocked]);

  useEffect(() => {
    setQuestions(null);
    setRevealed(new Set());
    api
      .studyQuestions({
        subject: wrongOnly || savedOnly ? null : subject,
        topic: topic || null,
        subtopic: subtopic || null,
        unlocked: auth.unlocked,
      })
      .then((rows) => {
        if (wrongOnly) {
          const ids = new Set(summarise().wrongIds);
          return setQuestions(rows.filter((q) => ids.has(q.id)));
        }
        if (savedOnly) {
          const ids = bookmarkSet();
          return setQuestions(rows.filter((q) => ids.has(q.id)));
        }
        setQuestions(rows);
      })
      .catch(setError);
  }, [subject, topic, subtopic, auth.unlocked, wrongOnly, savedOnly]);

  const topicRows = taxonomy?.[subject] ?? [];
  const subtopics = useMemo(
    () => topicRows.find((t) => t.topic === topic)?.subtopics ?? [],
    [topicRows, topic]
  );

  // Changing a filter drops the page: page 4 of the old list means nothing in
  // the new one.
  function pick(next) {
    const merged = { subject, topic, subtopic, ...next };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v));
    setParams(clean, { replace: true });
  }

  function goToPage(n) {
    const clean = Object.fromEntries(
      Object.entries({ subject, topic, subtopic, page: n > 1 ? String(n) : "" }).filter(
        ([, v]) => v
      )
    );
    setParams(clean, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = questions?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PREP_PER_PAGE));
  // A filter change can leave `page` past the end; clamp rather than show blank.
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * PREP_PER_PAGE;
  const to = from + PREP_PER_PAGE;
  const shown = questions?.slice(from, to) ?? [];
  const pageWindow = buildPageWindow(safePage, pageCount);

  if (error) {
    return (
      <>
        <SiteHeader auth={auth} />
        <div className="wrap"><div className="state">প্রশ্ন আনা যায়নি। আবার চেষ্টা করুন।</div></div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader auth={auth} />

      <div className="wrap prep">
        <div className="hero" style={{ padding: "34px 0 6px" }}>
          <h1 style={{ fontSize: 28 }}>প্রস্তুতি কক্ষ</h1>
          <p>
            পরীক্ষার আগে পড়ে নিন। প্রতিটি প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা একসঙ্গে
            দেওয়া আছে — এখানে কোনো সময়সীমা বা নম্বর নেই।
          </p>
        </div>

        {savedOnly && (
          <div className="card wrong-mode saved-mode">
            <b>সংরক্ষিত প্রশ্ন</b>
            <p>যেসব প্রশ্ন পরে দেখার জন্য রেখেছেন, কেবল সেগুলো দেখানো হচ্ছে।</p>
            <button
              type="button"
              className="linky"
              onClick={() => setParams({ subject }, { replace: true })}
            >
              সব প্রশ্নে ফিরে যান
            </button>
          </div>
        )}

        {wrongOnly && (
          <div className="card wrong-mode">
            <b>ভুল করা প্রশ্ন</b>
            <p>
              আগের পরীক্ষাগুলোতে যেসব প্রশ্ন ভুল হয়েছে বা উত্তর দেওয়া হয়নি,
              কেবল সেগুলো দেখানো হচ্ছে।
            </p>
            <button
              type="button"
              className="linky"
              onClick={() => setParams({ subject }, { replace: true })}
            >
              সব প্রশ্নে ফিরে যান
            </button>
          </div>
        )}

        <div className="card prep-filters" hidden={wrongOnly || savedOnly}>
          <div className="field">
            <span>বিষয়</span>
            <div className="chips">
              {SUBJECTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="chip"
                  aria-pressed={subject === s.key}
                  onClick={() => setParams({ subject: s.key }, { replace: true })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>টপিক</span>
            <select value={topic} onChange={(e) => pick({ topic: e.target.value, subtopic: "" })}>
              <option value="">সব টপিক</option>
              {topicRows.map((t) => (
                <option key={t.topic} value={t.topic}>{t.topic}</option>
              ))}
            </select>
          </label>

          {subtopics.length > 0 && (
            <label className="field">
              <span>উপ-টপিক</span>
              <select value={subtopic} onChange={(e) => pick({ subtopic: e.target.value })}>
                <option value="">সব উপ-টপিক</option>
                {subtopics.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}

          <label className="toggle">
            <input
              type="checkbox"
              checked={hideAnswers}
              onChange={(e) => {
                setHideAnswers(e.target.checked);
                setRevealed(new Set());
              }}
            />
            <span>উত্তর ঢেকে রাখুন — নিজে চেষ্টা করে তারপর দেখুন</span>
          </label>
        </div>

        {!questions ? (
          <div className="state">লোড হচ্ছে…</div>
        ) : questions.length === 0 ? (
          <div className="state">
            {wrongOnly
              ? "কোনো ভুল প্রশ্ন নেই — এখনো পরীক্ষা দেননি, অথবা সবগুলো সঠিক হয়েছে।"
              : savedOnly
                ? "এখনো কোনো প্রশ্ন সংরক্ষণ করা হয়নি। যেকোনো প্রশ্নের পাশে ☆ চাপুন।"
                : "এই টপিকে এখনো কোনো প্রশ্ন যোগ করা হয়নি।"}
          </div>
        ) : (
          <>
            {!auth.unlocked && (
              <p className="locked-note">
                লগইন ছাড়া মোট {bn(GUEST_QUESTION_LIMIT)}টি প্রশ্ন দেখা যায়।{" "}
                <Link to="/login">অনুমোদিত নম্বরে লগইন করুন</Link> — পুরো
                প্রশ্নব্যাংক খুলে যাবে।
              </p>
            )}

            <p className="prep-count">
              {bn(from + 1)}–{bn(Math.min(to, questions.length))} / {bn(questions.length)}টি প্রশ্ন
              {topic ? ` · ${topic}` : ` · ${SUBJECT_LABEL[subject]}`}
              {subtopic ? ` · ${subtopic}` : ""}
            </p>

            {shown.map((q, i) => {
              const marks = letters(q.subject);
              const open = !hideAnswers || revealed.has(q.id);
              return (
                <article className="rev prep-card" key={q.id}>
                  <div className="rev-tag rev-tag-row">
                    <span>
                      {q.topic}
                      {q.subtopic ? ` · ${q.subtopic}` : ""} · {DIFFICULTY_LABEL[q.difficulty]}
                      <ExamTag exam={q.exam} />
                    </span>
                    <BookmarkButton
                      id={q.id}
                      onChange={(id, on) => {
                        // In the saved-only view an un-saved question no longer
                        // belongs on screen.
                        if (savedOnly && !on) {
                          setQuestions((rows) => rows.filter((r) => r.id !== id));
                        }
                      }}
                    />
                  </div>
                  <h2 className="stem" style={{ fontSize: 17, marginBottom: 12 }}>
                    {bn(from + i + 1)}. {q.stem}
                  </h2>

                  <div className="opts">
                    {q.options.map((text, j) => (
                      <div
                        key={j}
                        className={`opt${open && j === q.answer ? " correct" : ""}`}
                      >
                        <span className="bubble">{marks[j]}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>

                  {open ? (
                    <div className="expl"><b>ব্যাখ্যা:</b> {q.explanation}</div>
                  ) : (
                    <button
                      type="button"
                      className="reveal"
                      onClick={() => setRevealed(new Set(revealed).add(q.id))}
                    >
                      উত্তর ও ব্যাখ্যা দেখুন
                    </button>
                  )}
                </article>
              );
            })}
          </>
        )}

        {pageCount > 1 && (
          <nav className="pager" aria-label="পৃষ্ঠা">
            <button
              type="button"
              className="pg"
              disabled={safePage === 1}
              onClick={() => goToPage(safePage - 1)}
            >
              আগের
            </button>

            {pageWindow.map((n, i) =>
              n === "…" ? (
                <span className="pg-gap" key={`gap-${i}`}>…</span>
              ) : (
                <button
                  type="button"
                  key={n}
                  className="pg num"
                  aria-current={n === safePage ? "page" : undefined}
                  onClick={() => goToPage(n)}
                >
                  {bn(n)}
                </button>
              )
            )}

            <button
              type="button"
              className="pg"
              disabled={safePage === pageCount}
              onClick={() => goToPage(safePage + 1)}
            >
              পরের
            </button>
          </nav>
        )}

        {/* Deliberately not .nav: `.nav button` outranks `.cta` on background
            but not on colour, which renders the label white on white. */}
        <div className="prep-cta">
          <Link to="/start">
            <button type="button" className="cta">পড়া হয়েছে — পরীক্ষা দিন</button>
          </Link>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}

/**
 * Page numbers to render: always the first and last, plus a window around the
 * current page, with gaps elided. Bangla has 150+ questions, so listing every
 * page would wrap onto several lines on a phone.
 */
function buildPageWindow(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const out = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);

  if (start > 2) out.push("…");
  for (let n = start; n <= end; n++) out.push(n);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}
