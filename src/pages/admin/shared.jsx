import { bn } from "@/lib/bn.js";

export const when = (ms) =>
  ms ? new Date(ms).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" }) : "—";

/** "Mozilla/5.0 (Linux; Android 13; SM-A135F) …" → "Android · Chrome" */
export function shortDevice(ua = "") {
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || "অজানা ডিভাইস";
}

/** A headline number. `label` in sentence case, no colon. */
export function Stat({ label, value, hint }) {
  return (
    <div className="ad-stat">
      <span className="ad-stat-label">{label}</span>
      <span className="ad-stat-value">{typeof value === "number" ? bn(value) : value}</span>
      {hint && <span className="ad-stat-hint">{hint}</span>}
    </div>
  );
}

/**
 * A ratio against a limit. The fill carries severity — ink, then amber past
 * 80%, then seal past 100% — and the track is a lighter step of the same hue.
 */
export function Meter({ label, used, limit, ratio, format = (n) => bn(n) }) {
  const pct = Math.min(100, Math.round(ratio * 100));
  const level = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "ok";
  return (
    <div className="ad-meter" data-level={level}>
      <div className="ad-meter-head">
        <span>{label}</span>
        <span className="ad-meter-val">
          {format(used)} / {format(limit)} · {bn(pct)}%
        </span>
      </div>
      <div className="ad-meter-track" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={label}>
        <div className="ad-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const ICON = { danger: "⛔", warning: "⚠️", info: "ℹ️" };
const LEVEL_LABEL = { danger: "জরুরি", warning: "সতর্কতা", info: "তথ্য" };

export function WarningList({ items }) {
  if (!items.length) {
    return (
      <div className="card notice notice-ok">
        <span aria-hidden="true">✅</span> সব ঠিক আছে — কোনো সতর্কতা নেই।
      </div>
    );
  }
  return (
    <ul className="notices">
      {items.map((w, i) => (
        <li className={`card notice notice-${w.level}`} key={i}>
          <span aria-hidden="true">{ICON[w.level]}</span>
          <div>
            <b>{LEVEL_LABEL[w.level]}:</b> {w.text}
            {w.action && <div className="fineprint">{w.action}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two-segment horizontal bar: guest share (light) inside the total (ink). */
export function SplitBar({ label, total, guest, max }) {
  const w = max ? (total / max) * 100 : 0;
  const g = total ? (guest / total) * 100 : 0;
  return (
    <div className="split-row">
      <span className="split-label">{label}</span>
      <div className="split-track">
        <div className="split-total" style={{ width: `${w}%` }}>
          <div className="split-guest" style={{ width: `${g}%` }} />
        </div>
      </div>
      <span className="split-val">
        {bn(total)} <small>({bn(guest)} গেস্ট)</small>
      </span>
    </div>
  );
}
