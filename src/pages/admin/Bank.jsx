import { SUBJECT_LABEL, DIFFICULTY_LABEL } from "@/lib/constants.js";
import { fmtBytes, FIRESTORE_FREE } from "@/lib/adminStats.js";
import { bn } from "@/lib/bn.js";
import { Stat, SplitBar, when } from "./shared.jsx";

export default function Bank({ snap, banks, stats }) {
  const b = stats.bank;
  if (!b) {
    return (
      <div className="card empty-state">
        <b>পুরো ব্যাংক পড়া যায়নি</b>
        <p>Firestore-এ ব্যাংক নেই বা পড়ার অনুমতি নেই। <code>npm run bank:upload</code> চালান।</p>
      </div>
    );
  }
  const maxSubject = Math.max(...b.bySubject.map((s) => s.total), 1);
  const biggest = Math.max(...b.chunks.map((c) => c.bytes), 0);

  return (
    <>
      <section className="pf-sec">
        <div className="ad-stats">
          <Stat label="মোট প্রশ্ন" value={b.total} />
          <Stat label="গেস্ট (অ্যাপে)" value={b.guest} />
          <Stat label="প্রাইভেট (Firestore)" value={b.private} />
          <Stat label="Firestore-এ আকার" value={fmtBytes(b.bytes)} hint={`${bn(b.chunks.length)}টি chunk`} />
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">বিষয় অনুযায়ী</h2>
        <div className="card">
          <div className="ad-legend">
            <span><i className="sw sw-total" /> মোট</span>
            <span><i className="sw sw-guest" /> গেস্ট অংশ</span>
          </div>
          {b.bySubject.map((s) => (
            <SplitBar key={s.subject} label={SUBJECT_LABEL[s.subject] ?? s.subject} total={s.total} guest={s.guest} max={maxSubject} />
          ))}
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">কাঠিন্য ও অবস্থা</h2>
        <div className="card">
          {b.byDifficulty.map((d) => (
            <div className="row" key={d.difficulty}>
              <span className="nm">{DIFFICULTY_LABEL[d.difficulty] ?? d.difficulty}</span>
              <span className="val">{bn(d.total)} <small>({bn(d.guest)} গেস্ট)</small></span>
            </div>
          ))}
          {b.byStatus.map((s) => (
            <div className="row" key={s.status}>
              <span className="nm">স্ট্যাটাস: {s.status}</span>
              <span className="val">{bn(s.total)}</span>
            </div>
          ))}
          <div className="row">
            <span className="nm">মেয়াদ আছে এমন প্রশ্ন (expires_at)</span>
            <span className="val">{bn(b.expiring)}</span>
          </div>
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">টপিক অনুযায়ী</h2>
        {Object.entries(b.topics).map(([subject, rows]) => (
          <details className="card topic-group" key={subject}>
            <summary>
              <b>{SUBJECT_LABEL[subject] ?? subject}</b> · {bn(rows.length)} টপিক · {bn(rows.reduce((n, r) => n + r.total, 0))} প্রশ্ন
            </summary>
            {rows.map((r) => (
              <div className="row" key={r.topic}>
                <span className="nm">{r.topic}</span>
                <span className="val">{bn(r.total)} <small>({bn(r.guest)} গেস্ট)</small></span>
              </div>
            ))}
          </details>
        ))}
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">Firestore chunk</h2>
        <div className="card">
          <p className="fineprint" style={{ marginTop: 0 }}>
            প্রতিটি ডকুমেন্টের সীমা ১ MiB। সবচেয়ে বড় chunk {fmtBytes(biggest)} ({bn(Math.round((biggest / FIRESTORE_FREE.docMaxBytes) * 100))}%)।
          </p>
          {b.chunks.map((c) => (
            <div className="row" key={c.index}>
              <span className="nm">chunk-{bn(c.index)}</span>
              <span className="val">{bn(c.count)}টি প্রশ্ন · {fmtBytes(c.bytes)}</span>
            </div>
          ))}
          <div className="row" style={{ borderBottom: 0 }}>
            <span className="nm">সংস্করণ</span>
            <span className="val">
              {snap.bank ? `v${snap.bank.version} · ${snap.bank.generatedAt ? when(Date.parse(snap.bank.generatedAt)) : "—"}` : "আপলোড হয়নি"}
            </span>
          </div>
        </div>
        <p className="fineprint">
          <code>content/</code> বদলালে <code>npm run bank:upload</code> — প্রাইভেট অংশ Firestore-এ যায়; গেস্ট অংশ পরের ডিপ্লয়ে।
          অ্যাপে থাকা গেস্ট ব্যাংক: {banks.guest?.meta?.generated_at ? when(Date.parse(banks.guest.meta.generated_at)) : "—"}।
        </p>
      </section>
    </>
  );
}
