import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import ResumeBanner from "@/components/ResumeBanner.jsx";
import HowItWorks from "@/components/HowItWorks.jsx";
import { api } from "@/api";
import { bn } from "@/lib/bn.js";
import { DEMO_COUNT, SUBJECTS } from "@/lib/constants.js";

const COMPARE = [
  ["প্রশ্নের ধরন", "পুরোনো প্রশ্নের ধাঁচে, গ্রেড অনুযায়ী", "এক বই সবার জন্য এক"],
  ["উত্তরের ব্যাখ্যা", "প্রতিটি প্রশ্নে, পরীক্ষার পরপরই", "আলাদা করে খুঁজে নিতে হয়"],
  ["নেগেটিভ মার্কিং", "গ্রেড অনুযায়ী আসল নিয়মে হিসাব", "নিজে হিসাব করতে হয়"],
  ["সময় ব্যবস্থাপনা", "ঘড়ি ধরে, ব্যাকগ্রাউন্ডেও সময় ঠিক থাকে", "অনুশীলনে সময়ের চাপ বোঝা যায় না"],
  ["দুর্বল টপিক চিহ্নিতকরণ", "ফলাফলেই আলাদা করে দেখানো হয়", "নিজে বুঝে নিতে হয়"],
  ["প্রশ্ন পুনরাবৃত্তি", "প্রতিবার নতুন করে সাজানো হয়", "একই প্রশ্ন বারবার"],
  ["খরচ", "বিনামূল্যে", "বই ও কোচিং বাবদ খরচ"],
];

const LIMITS = [
  "প্রশ্নব্যাংক এখনো বাড়ছে — সব টপিকে সমান গভীরতা নেই।",
  "পরীক্ষার মাঝপথে পাতা রিফ্রেশ করলে খাতা হারিয়ে যায়।",
  "এখনো ফলাফলের ইতিহাস সংরক্ষিত হয় না।",
];

export default function Home({ auth, attempt }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  // Advertised from the live bank, so the page cannot overstate what it holds.
  useEffect(() => {
    api.stats?.({ unlocked: auth.unlocked }).then(setStats).catch(() => setStats(null));
  }, [auth.unlocked]);

  return (
    <>
      <SiteHeader auth={auth} />

      <section className="hero-wrap">
        <div className="wrap hero-solo">
          <ResumeBanner attempt={attempt} />
          <p className="eyebrow">সরকারি চাকরির নিয়োগ পরীক্ষা</p>
          <h1 className="hero-title">
            ১১–২০ গ্রেডের প্রস্তুতি নিন<br />আসল পরীক্ষার নিয়মে
          </h1>
          <p className="hero-sub">
            বাংলা, ইংরেজি, গণিত ও সাধারণ জ্ঞান। আপনার গ্রেড অনুযায়ী প্রশ্নপত্র
            তৈরি হবে — প্রশ্নসংখ্যা, সময় আর নেগেটিভ মার্কিং সবই আলাদা। প্রতিটি
            উত্তরের ব্যাখ্যা পরীক্ষা শেষেই।
          </p>

          <ul className="subject-chips">
            {SUBJECTS.map((s) => (
              <li key={s.key}>{s.label}</li>
            ))}
          </ul>

          <div className="cta-row">
            <button type="button" className="cta" onClick={() => navigate("/start")}>
              পূর্ণ মডেল টেস্ট শুরু করুন
            </button>
            <button type="button" className="cta ghost" onClick={() => navigate("/demo")}>
              ফ্রি ডেমো — {bn(DEMO_COUNT)} প্রশ্ন
            </button>
          </div>
          <p className="cta-note">
            ডেমো দিতে লগইন লাগবে না।
            {stats?.locked &&
              ` লগইন ছাড়া ${bn(stats.guestLimit)}টি প্রশ্ন — অনুমোদিত নম্বরে লগইন করলে সবগুলো।`}
          </p>
        </div>
      </section>

      <section className="stats-band">
        <div className="wrap stats-in">
          {[
            ["questions", "প্রশ্ন", stats?.questions],
            ["topics", "টপিক", stats?.topics],
            ["subjects", "বিষয়", stats?.subjects],
            ["bands", "গ্রেড ব্যান্ড", stats?.bands],
          ].map(([k, label, value]) => (
            <div className="stat" key={k}>
              <b>{value == null ? "—" : bn(value)}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>


      <HowItWorks />

      <section className="wrap band-sec">
        <h2 className="sec-title">কেন এই অ্যাপ</h2>
        <p className="sec-sub">
          প্রচলিত প্রস্তুতির সঙ্গে তুলনা। যেটুকু এখনো পারি না, সেটাও নিচে লেখা আছে।
        </p>

        <div className="cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th scope="col">যেদিক থেকে</th>
                <th scope="col">এই অ্যাপ</th>
                <th scope="col">শুধু বই বা গাইড</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([k, us, them]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="yes">
                    <span className="tick" aria-hidden="true">✓</span>
                    {us}
                  </td>
                  <td className="no">
                    <span className="cross" aria-hidden="true">✕</span>
                    {them}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="limits">
          <b>যা এখনো পারি না</b>
          <ul>
            {LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap band-sec">
        <h2 className="sec-title">দুইভাবে অনুশীলন</h2>
        <div className="mode-grid">
          <Link to="/start" className="mode-card">
            <b>পূর্ণ মডেল টেস্ট</b>
            <p>
              চার বিষয় মিলিয়ে একটি সম্পূর্ণ প্রশ্নপত্র। গ্রেড আর প্রশ্নসংখ্যা
              আপনি ঠিক করবেন, প্রতিবার নতুন প্রশ্ন আসবে।
            </p>
            <span className="go-link">শুরু করুন →</span>
          </Link>
          <Link to="/start?mode=topic" className="mode-card">
            <b>বিষয়ভিত্তিক অনুশীলন</b>
            <p>
              একটি বিষয় বেছে নিন, তারপর নির্দিষ্ট টপিক — শুধু সন্ধি, শুধু
              শতকরা, বা যেটিতে দুর্বলতা আছে সেটি।
            </p>
            <span className="go-link">টপিক বাছুন →</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
