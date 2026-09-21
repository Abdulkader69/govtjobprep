import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import {
  listAttempts,
  summarise,
  weakestTopics,
  clearHistory,
  deleteAttempt,
  exportAll,
} from "@/lib/history.js";
import { SUBJECT_LABEL, BANDS } from "@/lib/constants.js";
import { GUEST_QUESTION_LIMIT } from "@/lib/access.js";
import { listBookmarks } from "@/lib/bookmarks.js";
import { bn, mark } from "@/lib/bn.js";
import { usePageMeta } from "@/lib/usePageMeta.js";

const MODE_LABEL = { full: "পূর্ণ মডেল টেস্ট", topic: "বিষয়ভিত্তিক", demo: "ডেমো" };

export default function Profile({ auth }) {
  const [version, setVersion] = useState(0);
  usePageMeta("প্রোফাইল", undefined);
  const [confirming, setConfirming] = useState(false);

  const attempts = useMemo(() => listAttempts(), [version]);
  const summary = useMemo(() => summarise(attempts), [attempts]);
  const weak = useMemo(() => weakestTopics(summary), [summary]);
  const saved = useMemo(() => listBookmarks(), [version]);

  function download() {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prostuti-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Accounts only. A guest's results still live in this browser and will
  // appear here the moment they register or log in.
  if (auth.ready && !auth.user) return <Navigate to="/login?next=/profile" replace />;
  if (!auth.user) return <div className="state">লোড হচ্ছে…</div>;

  return (
    <>
      <SiteHeader auth={auth} />

      <div className="wrap prep">
        <div className="hero" style={{ padding: "34px 0 6px" }}>
          <h1 style={{ fontSize: 28 }}>প্রোফাইল</h1>
          <p>
            {auth.user.name ?? auth.user.email ?? auth.user.phone} —{" "}
            {auth.unlocked
              ? "প্রিমিয়াম: পুরো প্রশ্নব্যাংক খোলা আছে।"
              : `ফ্রি: ${bn(GUEST_QUESTION_LIMIT)}টি প্রশ্ন ব্যবহার করা যাচ্ছে। প্রিমিয়ামের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।`}
          </p>
        </div>

        {attempts.length === 0 ? (
          <div className="card empty-state">
            <b>এখনো কোনো পরীক্ষা দেওয়া হয়নি</b>
            <p>
              একটি পরীক্ষা শেষ করলেই ফলাফল এখানে জমা হবে — কোন টপিকে দুর্বলতা,
              কতটা উন্নতি হচ্ছে, সবই দেখা যাবে।
            </p>
            <Link to="/start">
              <button type="button" className="cta">প্রথম পরীক্ষা দিন</button>
            </Link>
          </div>
        ) : (
          <>
            <section className="pf-grid">
              {[
                ["পরীক্ষা দিয়েছি", bn(summary.attempts)],
                ["মোট প্রশ্ন", bn(summary.questionsSeen)],
                ["সঠিক উত্তর", `${Math.round(summary.accuracy)}%`],
                ["সেরা ফল", `${Math.round(summary.bestScore)}%`],
              ].map(([label, value]) => (
                <div className="pf-stat" key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            <ScoreTrend attempts={attempts} />

            <section className="pf-sec">
              <h2 className="sec-title" style={{ fontSize: 20 }}>বিষয়ভিত্তিক ফল</h2>
              <div className="brk">
                {Object.entries(summary.perSubject).map(([key, v]) => (
                  <div className="row" key={key}>
                    <span className="nm">{SUBJECT_LABEL[key] ?? key}</span>
                    <span className="meter">
                      <i style={{ width: `${(v.correct / v.total) * 100}%` }} />
                    </span>
                    <span className="val">
                      {bn(v.correct)}/{bn(v.total)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {weak.length > 0 && (
              <section className="pf-sec">
                <h2 className="sec-title" style={{ fontSize: 20 }}>যেসব টপিকে দুর্বলতা</h2>
                <p className="sec-sub" style={{ marginBottom: 14 }}>
                  সব পরীক্ষা মিলিয়ে হিসাব। দুর্বলতম আগে।
                </p>
                <ul className="weak-list">
                  {weak.map((t) => (
                    <li key={t.key}>
                      <Link
                        to={`/prepare?subject=${t.subject}&topic=${encodeURIComponent(t.topic)}`}
                      >
                        <span className="wl-topic">{t.topic}</span>
                        <span className="wl-sub">{SUBJECT_LABEL[t.subject] ?? t.subject}</span>
                      </Link>
                      <span className="wl-score" data-low={t.accuracy < 50 ? "true" : undefined}>
                        {Math.round(t.accuracy)}%
                        <small>
                          {bn(t.correct)}/{bn(t.total)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {saved.length > 0 && (
              <section className="pf-sec">
                <div className="card wrong-bank saved-bank">
                  <b>সংরক্ষিত প্রশ্ন: {bn(saved.length)}টি</b>
                  <p>পরে দেখার জন্য যেসব প্রশ্ন রেখেছেন।</p>
                  <Link to="/prepare?saved=1">
                    <button type="button" className="cta ghost">সংরক্ষিত প্রশ্ন দেখুন</button>
                  </Link>
                </div>
              </section>
            )}

            {summary.wrongIds.length > 0 && (
              <section className="pf-sec">
                <div className="card wrong-bank">
                  <b>ভুল করা প্রশ্ন: {bn(summary.wrongIds.length)}টি</b>
                  <p>
                    যেসব প্রশ্ন ভুল হয়েছে বা উত্তর দেওয়া হয়নি, সেগুলো আলাদা করে
                    রাখা আছে। এগুলো আবার দেখে নিলে পরের পরীক্ষায় নম্বর বাড়বে।
                  </p>
                  <Link to="/prepare?wrong=1">
                    <button type="button" className="cta">ভুল প্রশ্নগুলো পড়ুন</button>
                  </Link>
                </div>
              </section>
            )}

            <section className="pf-sec">
              <h2 className="sec-title" style={{ fontSize: 20 }}>পরীক্ষার তালিকা</h2>
              <div className="pf-table-wrap">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th scope="col">তারিখ</th>
                      <th scope="col">ধরন</th>
                      <th scope="col">গ্রেড</th>
                      <th scope="col">ফল</th>
                      <th scope="col">
                        <span className="sr-only">মুছুন</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.finishedAt)}</td>
                        <td>
                          {MODE_LABEL[a.mode] ?? a.mode}
                          {a.auto && <span className="pf-auto">সময় শেষ</span>}
                        </td>
                        <td>{BANDS[a.band]?.label ?? a.band ?? "—"}</td>
                        <td>
                          <b style={{ color: a.passed ? "var(--ok)" : "var(--seal)" }}>
                            {mark(a.score)}
                          </b>
                          <small> / {bn(a.total)}</small>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="linky"
                            onClick={() => {
                              deleteAttempt(a.id);
                              setVersion((v) => v + 1);
                            }}
                          >
                            মুছুন
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="pf-sec">
              <h2 className="sec-title" style={{ fontSize: 20 }}>তথ্য ব্যবস্থাপনা</h2>
              <p className="sec-sub">
                ফলাফল শুধু এই ব্রাউজারে রাখা আছে — কোনো সার্ভারে নয়। ব্রাউজারের
                ডেটা মুছে ফেললে এগুলোও চলে যাবে, তাই মাঝেমধ্যে ব্যাকআপ রাখুন।
              </p>
              <div className="pf-actions">
                <button type="button" className="cta ghost" onClick={download}>
                  ব্যাকআপ ডাউনলোড করুন
                </button>
                {confirming ? (
                  <>
                    <button
                      type="button"
                      className="cta danger"
                      onClick={() => {
                        clearHistory();
                        setConfirming(false);
                        setVersion((v) => v + 1);
                      }}
                    >
                      নিশ্চিত — সব মুছে ফেলুন
                    </button>
                    <button type="button" className="cta ghost" onClick={() => setConfirming(false)}>
                      বাতিল
                    </button>
                  </>
                ) : (
                  <button type="button" className="cta ghost" onClick={() => setConfirming(true)}>
                    সব ফলাফল মুছুন
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <SiteFooter auth={auth} />
    </>
  );
}

/**
 * Score over time, oldest to newest.
 *
 * Inline SVG rather than a chart library: one series of a few dozen points does
 * not justify the bundle, and this stays legible on a phone.
 */
function ScoreTrend({ attempts }) {
  const points = [...attempts].reverse().map((a) => (a.total ? (a.score / a.total) * 100 : 0));
  if (points.length < 2) return null;

  const w = 100;
  const h = 34;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (p / 100) * h).toFixed(2)}`)
    .join(" ");

  return (
    <section className="pf-sec">
      <h2 className="sec-title" style={{ fontSize: 20 }}>ফলাফলের ধারা</h2>
      <p className="sec-sub" style={{ marginBottom: 12 }}>
        বাঁ দিক থেকে ডান দিকে — পুরোনো থেকে সাম্প্রতিক। শতকরা হিসাবে।
      </p>
      <div className="trend">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
             aria-label={`ফলাফলের ধারা, ${points.length}টি পরীক্ষা`}>
          <line x1="0" y1={h / 2} x2={w} y2={h / 2} className="trend-mid" />
          <path d={path} className="trend-line" />
        </svg>
        <div className="trend-ends">
          <span>{Math.round(points[0])}%</span>
          <span>{Math.round(points.at(-1))}%</span>
        </div>
      </div>
    </section>
  );
}

function formatDate(ms) {
  const d = new Date(ms);
  return bn(
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  );
}
