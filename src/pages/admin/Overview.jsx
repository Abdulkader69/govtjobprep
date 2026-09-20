import { firebaseConfig } from "@/api/firebase.config.js";
import { bankSource } from "@/lib/bank.js";
import { fmtBytes } from "@/lib/adminStats.js";
import { bn } from "@/lib/bn.js";
import { Stat, Meter, WarningList, when } from "./shared.jsx";

const CONSOLE = (project) => `https://console.firebase.google.com/project/${project}`;

export default function Overview({ snap, banks, stats, auth }) {
  const { users, admins, orphanSessions } = snap;
  const { usage, warnings } = stats;
  const project = firebaseConfig.projectId;
  const env = import.meta.env ?? {};

  return (
    <>
      <section className="pf-sec">
        <h2 className="sec-title">সতর্কতা</h2>
        <WarningList items={warnings} />
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">এক নজরে</h2>
        <div className="ad-stats">
          <Stat label="মোট ব্যবহারকারী" value={users.length} />
          <Stat label="পুরো ব্যাংক খোলা" value={users.filter((u) => u.plan === "full").length} />
          <Stat label="এখন লগইন আছেন" value={usage.sessions} hint={orphanSessions.length ? `${bn(orphanSessions.length)}টি প্রোফাইলহীন` : undefined} />
          <Stat label="আজ লগইন" value={usage.loginsToday} />
          <Stat label="বন্ধ অ্যাকাউন্ট" value={users.filter((u) => u.disabled).length} />
          <Stat label="অ্যাডমিন" value={admins.length} />
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">Firebase ব্যবহার <small>(আনুমানিক, ফ্রি প্ল্যানের সীমার তুলনায়)</small></h2>
        <div className="card">
          <Meter label="Firestore স্টোরেজ" {...usage.storage} format={fmtBytes} />
          <Meter label="আজকের রিড (প্রক্ষেপণ)" {...usage.reads} />
          <Meter label="আজকের রাইট (প্রক্ষেপণ)" {...usage.writes} />
          <p className="fineprint" style={{ marginTop: 10 }}>
            ওয়েব অ্যাপ Firestore-এর কাউন্টার দেখতে পায় না; স্টোরেজ ডকুমেন্টের আকার যোগ করে এবং
            রিড/রাইট আজকের লগইন থেকে অনুমান করা। প্রকৃত সংখ্যা{" "}
            <a href={`${CONSOLE(project)}/usage`} target="_blank" rel="noreferrer">কনসোলের Usage পাতায়</a>।
            মোট ডকুমেন্ট ≈ {bn(usage.docs)}টি।
          </p>
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">কনফিগারেশন</h2>
        <div className="card">
          <Row k="Firebase প্রজেক্ট" v={project ?? "—"} />
          <Row k="সাইন-ইন" v={auth.mode === "firebase" ? "Firebase (ইমেইল/মোবাইল + পাসওয়ার্ড)" : "local (ডেভেলপমেন্ট)"} />
          <Row k="ফোন OTP" v={auth.phoneLogin ? "চালু" : "বন্ধ (Blaze প্ল্যান লাগে)"} />
          <Row k="ডিভাইস নীতি" v={env.VITE_SESSION_POLICY === "block" ? "block — দ্বিতীয় ডিভাইস প্রত্যাখ্যাত" : "replace — নতুন ডিভাইস পুরনোটিকে সাইন আউট করে"} />
          <Row k="সেশন মেয়াদ" v={`${bn(env.VITE_SESSION_TTL_DAYS || 30)} দিন`} />
          <Row k="পুরো ব্যাংকের উৎস" v={bankSource === "firestore" ? "Firestore (bank/)" : "bundle — ডেভেলপমেন্ট, সব প্রশ্ন পাবলিক!"} />
          <Row k="অ্যাপে থাকা ব্যাংক" v={`${bn(banks.guest?.questions?.length ?? 0)}টি গেস্ট প্রশ্ন · ${banks.guest?.meta?.generated_at ? when(Date.parse(banks.guest.meta.generated_at)) : "—"}`} />
          <Row k="Firestore-এ ব্যাংক" v={snap.bank ? `${bn(snap.bank.total)}টি প্রশ্ন · ${bn(snap.bank.chunks)} chunk · v${snap.bank.version} · ${snap.bank.generatedAt ? when(Date.parse(snap.bank.generatedAt)) : "—"}` : "নেই"} />
        </div>
      </section>

      <section className="pf-sec">
        <h2 className="sec-title">Firebase কনসোল</h2>
        <div className="card links">
          <a href={`${CONSOLE(project)}/authentication/users`} target="_blank" rel="noreferrer">Authentication → Users</a>
          <a href={`${CONSOLE(project)}/firestore/databases/-default-/data`} target="_blank" rel="noreferrer">Firestore → Data</a>
          <a href={`${CONSOLE(project)}/firestore/databases/-default-/rules`} target="_blank" rel="noreferrer">Firestore → Rules</a>
          <a href={`${CONSOLE(project)}/usage`} target="_blank" rel="noreferrer">Usage &amp; billing</a>
        </div>
        <p className="fineprint">
          অ্যাকাউন্ট মুছতে, পাসওয়ার্ড সমস্যায়, বা নতুন অ্যাডমিন যোগ করতে (Firestore → admins) কনসোল লাগে; বাকি সব এখানেই।
        </p>
      </section>
    </>
  );
}

function Row({ k, v }) {
  return (
    <div className="row">
      <span className="nm">{k}</span>
      <span className="val" style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}
