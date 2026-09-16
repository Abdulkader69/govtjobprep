import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import ResumeBanner from "@/components/ResumeBanner.jsx";
import { api } from "@/api";
import { BANDS, SUBJECTS, COUNT_OPTIONS, DEFAULT_COUNT } from "@/lib/constants.js";
import { bn } from "@/lib/bn.js";

/**
 * Exam setup for both modes.
 *
 * "full"  — four subjects, blueprint-shaped, candidate picks band and length.
 * "topic" — one subject, candidate picks which topics to drill.
 */
export default function ExamSetup({ attempt, auth }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "topic" ? "topic" : "full";

  const [profiles, setProfiles] = useState(null);
  const [taxonomy, setTaxonomy] = useState(null);
  const [error, setError] = useState(null);

  const [band, setBand] = useState("13-16");
  // Null until the supply is known. Defaulting to a number here would stick:
  // before profiles load the offered list is just [10], and a count already in
  // the list is never revised.
  const [count, setCount] = useState(null);
  const [subject, setSubject] = useState("bangla");
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    Promise.all([
      api.profiles({ unlocked: auth.unlocked }),
      api.topics?.({ unlocked: auth.unlocked }) ?? {},
    ])
      .then(([p, t]) => {
        setProfiles(p);
        setTaxonomy(t);
      })
      .catch(setError);
  }, [auth.unlocked]);

  const profile = profiles?.find((p) => p.grade_band === band);
  const available = profile?.supply?.actual ?? 0;

  // Never offer a paper the bank cannot fill — and offer nothing at all until
  // the supply is known, so the default is not chosen against a placeholder.
  const counts = useMemo(
    () => (profile ? COUNT_OPTIONS.filter((c) => c <= Math.max(10, available)) : []),
    [profile, available]
  );
  useEffect(() => {
    if (!counts.length) return;
    if (count === null) setCount(counts.includes(DEFAULT_COUNT) ? DEFAULT_COUNT : counts.at(-1));
    else if (!counts.includes(count)) setCount(counts.at(-1));
  }, [counts, count]);

  // `profile` is derived from `profiles`, so `counts` stays empty until the
  // fetch lands. Listed here to make that dependency explicit to a reader.

  const topics = (taxonomy?.[subject] ?? []).map((t) => t.topic);
  useEffect(() => setPicked([]), [subject]);

  if (!auth.user && auth.ready) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/start?mode=${mode}`)}`} replace />;
  }

  async function begin() {
    try {
      await attempt.start({
        band,
        count,
        shuffle: true,
        unlocked: auth.unlocked,
        ...(mode === "topic"
          ? { subjects: [subject], topics: picked.length ? picked : null }
          : {}),
      });
      navigate("/exam");
    } catch (e) {
      setError(e);
    }
  }

  if (error) {
    return (
      <>
        <SiteHeader auth={auth} />
        <div className="wrap">
          <div className="state">
            <p>প্রশ্নপত্র আনা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>
            <button className="cta" onClick={() => window.location.reload()}>
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (!profiles) {
    return (
      <>
        <SiteHeader auth={auth} />
        <div className="wrap"><div className="state">লোড হচ্ছে…</div></div>
      </>
    );
  }

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap narrow">
        <div className="hero" style={{ paddingBottom: 10 }}>
          <h1 style={{ fontSize: 24 }}>পরীক্ষার ধরন ঠিক করুন</h1>
        </div>

        <ResumeBanner attempt={attempt} />

        <div className="tabs" role="tablist">
          {[
            ["full", "পূর্ণ মডেল টেস্ট"],
            ["topic", "বিষয়ভিত্তিক"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              className="tab"
              onClick={() => setParams(k === "topic" ? { mode: "topic" } : {})}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card">
          <label className="field">
            <span>গ্রেড</span>
            <select value={band} onChange={(e) => setBand(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.grade_band} value={p.grade_band}>
                  {BANDS[p.grade_band].label} — {BANDS[p.grade_band].note}
                </option>
              ))}
            </select>
          </label>

          {mode === "topic" && (
            <>
              <label className="field">
                <span>বিষয়</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>

              <fieldset className="field">
                <legend>
                  টপিক
                  <small>
                    {picked.length
                      ? ` — ${bn(picked.length)}টি বাছাই করা`
                      : " — কিছু না বাছলে পুরো বিষয় থেকে আসবে"}
                  </small>
                </legend>
                <div className="chips">
                  {topics.map((t) => {
                    const on = picked.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        className="chip"
                        aria-pressed={on}
                        onClick={() =>
                          setPicked(on ? picked.filter((x) => x !== t) : [...picked, t])
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          <label className="field">
            <span>কতটি প্রশ্ন</span>
            <select
              value={count ?? ""}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {counts.map((c) => (
                <option key={c} value={c}>{bn(c)}টি প্রশ্ন</option>
              ))}
            </select>
          </label>

          <dl className="summary">
            <div><dt>প্রশ্ন</dt><dd>{count ? `${bn(count)}টি` : "—"}</dd></div>
            <div><dt>সময়</dt><dd>{count ? `${bn(scaleMinutes(profile, count))} মিনিট` : "—"}</dd></div>
            <div>
              <dt>নেগেটিভ</dt>
              <dd>{profile?.negative_mark ? bn(profile.negative_mark) : "নেই"}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="cta"
            style={{ width: "100%" }}
            disabled={attempt.status === "loading" || !count}
            onClick={begin}
          >
            {attempt.status === "loading" ? "প্রস্তুত হচ্ছে…" : "পরীক্ষা শুরু করুন"}
          </button>

          {mode === "topic" && picked.length > 0 && (
            <p className="fineprint">
              বাছাই করা টপিকে যথেষ্ট প্রশ্ন না থাকলে প্রশ্নপত্র ছোট হতে পারে।
            </p>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/** Mirrors resizeProfile in src/lib/paper.js, for display before the paper exists. */
function scaleMinutes(profile, count) {
  if (!profile || !count) return 0;
  return Math.max(1, Math.round((profile.minutes * count) / profile.questions));
}
