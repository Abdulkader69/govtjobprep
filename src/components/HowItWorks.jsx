import { useCallback, useEffect, useRef, useState } from "react";
import { bn } from "@/lib/bn.js";

/**
 * Screenshots of the real app rather than illustrations — a visitor deciding
 * whether to use this wants to see what it actually looks like.
 */
const SLIDES = [
  {
    image: "/how/1-setup.png",
    title: "গ্রেড ও প্রশ্নসংখ্যা বেছে নিন",
    body: "১১–১২, ১৩–১৬ না ১৭–২০ — গ্রেড অনুযায়ী প্রশ্নসংখ্যা, সময় ও নেগেটিভ মার্কিং নিজে থেকেই ঠিক হয়ে যায়। কত প্রশ্নের পরীক্ষা দেবেন সেটিও আপনি ঠিক করবেন।",
  },
  {
    image: "/how/2-exam.png",
    title: "আসল পরীক্ষার নিয়মে উত্তর দিন",
    body: "ওএমআর ধাঁচে উত্তর, উপরে ঘড়ি। উত্তর দেওয়া প্রশ্ন বাদ দিতে চাইলে আবার চাপ দিন — নেগেটিভ মার্কিং থাকলে ফাঁকা রাখাই ভালো। সময় শেষ হলে খাতা নিজেই জমা হয়ে যায়।",
  },
  {
    image: "/how/3-explain.png",
    title: "প্রতিটি উত্তরের ব্যাখ্যা দেখুন",
    body: "পরীক্ষা শেষে সঠিক উত্তর আর কেন সেটি সঠিক — দুটোই একসঙ্গে। প্রস্তুতি কক্ষে পরীক্ষার আগেও টপিক ধরে ধরে পড়ে নেওয়া যায়।",
  },
  {
    image: "/how/4-progress.png",
    title: "অগ্রগতি প্রোফাইলে জমা থাকে",
    body: "প্রতিটি পরীক্ষার ফল, কোন টপিকে দুর্বলতা, আর ভুল করা প্রশ্নগুলো আলাদা করে রাখা থাকে — যাতে পরের বার সেগুলোই আগে অনুশীলন করতে পারেন।",
  },
];

export default function HowItWorks() {
  const [index, setIndex] = useState(0);
  const region = useRef(null);
  const touchX = useRef(null);
  const last = SLIDES.length - 1;

  const go = useCallback((next) => {
    setIndex(Math.max(0, Math.min(last, next)));
  }, [last]);

  // Arrow keys work only while the slideshow has focus, so they never fight
  // with the rest of the page.
  useEffect(() => {
    const el = region.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go, index]);

  const slide = SLIDES[index];

  return (
    <section className="how-sec">
      <div className="wrap band-sec" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2 className="sec-title">কীভাবে কাজ করে</h2>
          <p className="sec-sub">চার ধাপে — অ্যাপের আসল স্ক্রিনশট।</p>
        </div>

        <div
          className="slides"
          ref={region}
          tabIndex={0}
          role="group"
          aria-roledescription="স্লাইডশো"
          aria-label="কীভাবে কাজ করে"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            touchX.current = null;
          }}
        >
          <div className="video-frame">
            <div className="slide-stage">
              {SLIDES.map((s, i) => (
                <img
                  key={s.image}
                  src={s.image}
                  alt={s.title}
                  width="1000"
                  height="563"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={`slide-img${i === index ? " on" : ""}`}
                  aria-hidden={i === index ? undefined : "true"}
                />
              ))}
            </div>
          </div>

          {/* aria-live so the caption is announced when the slide changes. */}
          <div className="slide-copy" aria-live="polite">
            <span className="slide-step">
              ধাপ {bn(index + 1)} / {bn(SLIDES.length)}
            </span>
            <b>{slide.title}</b>
            <p>{slide.body}</p>
          </div>

          <div className="slide-nav">
            <button
              type="button" className="pg"
              onClick={() => go(index - 1)} disabled={index === 0}
              aria-label="আগের ধাপ"
            >
              ←
            </button>

            <div className="dots" role="tablist" aria-label="ধাপ নির্বাচন">
              {SLIDES.map((s, i) => (
                <button
                  key={s.image}
                  type="button"
                  role="tab"
                  className="dot-btn"
                  aria-selected={i === index}
                  aria-label={`ধাপ ${i + 1}: ${s.title}`}
                  onClick={() => go(i)}
                />
              ))}
            </div>

            <button
              type="button" className="pg"
              onClick={() => go(index + 1)} disabled={index === last}
              aria-label="পরের ধাপ"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
