import { bn, clock } from "@/lib/bn.js";

export default function ExamBar({ left, from, to, total, answered, onOpenGrid, offline }) {
  return (
    <div className="bar">
      <div className="wrap">
        <div className="bar-in">
          <span
            className={`clock${left <= 120 ? " low" : ""}`}
            role="timer"
            aria-live="off"
            aria-label={`বাকি সময় ${clock(left)}`}
          >
            {clock(left)}
          </span>
          <span className="count">
            {from === to ? bn(from) : `${bn(from)}–${bn(to)}`}/{bn(total)} · উত্তর দেওয়া {bn(answered)}
          </span>
          <button type="button" className="ghost" onClick={onOpenGrid}>
            প্রশ্নপত্র
          </button>
        </div>
      </div>
      <div className="track">
        <i style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
      </div>
      {offline && (
        <div className="warn offline">
          ইন্টারনেট সংযোগ নেই — উত্তর সেভ হয়ে আছে, সংযোগ ফিরলে পাঠানো হবে।
        </div>
      )}
      {left <= 300 && left > 0 && (
        <div className="warn">
          সময় প্রায় শেষ — বাকি {clock(left)}। সময় ফুরালে খাতা নিজে থেকেই জমা হয়ে যাবে।
        </div>
      )}
    </div>
  );
}
