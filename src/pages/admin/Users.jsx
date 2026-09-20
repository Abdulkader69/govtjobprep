import { useMemo, useState } from "react";
import { bn } from "@/lib/bn.js";
import { when, shortDevice } from "./shared.jsx";

const FILTERS = [
  ["all", "সব"],
  ["full", "পুরো ব্যাংক"],
  ["guest", "গেস্ট"],
  ["online", "লগইন আছে"],
  ["disabled", "বন্ধ"],
  ["admin", "অ্যাডমিন"],
];

export default function Users({ snap, self, auth, act }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snap.users.filter((u) => {
      if (filter === "full" && u.plan !== "full") return false;
      if (filter === "guest" && u.plan === "full") return false;
      if (filter === "online" && !u.session) return false;
      if (filter === "disabled" && !u.disabled) return false;
      if (filter === "admin" && !u.isAdmin) return false;
      return !q || [u.name, u.email, u.phone, u.uid].some((f) => f && String(f).toLowerCase().includes(q));
    });
  }, [snap.users, query, filter]);

  async function run(uid, fn) {
    setBusy(uid);
    await act(fn);
    setBusy(null);
  }

  return (
    <>
      <div className="card form" style={{ marginBottom: 18 }}>
        <label className="field" style={{ marginBottom: 12 }}>
          <span>খুঁজুন</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম, ইমেইল, মোবাইল বা uid" />
        </label>
        <div className="chips">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <p className="fineprint" style={{ marginTop: 10 }}>
          {bn(shown.length)} / {bn(snap.users.length)} জন
        </p>
      </div>

      {shown.length === 0 && (
        <div className="card empty-state">
          <b>{query || filter !== "all" ? "কাউকে পাওয়া যায়নি" : "এখনো কেউ রেজিস্টার করেননি"}</b>
        </div>
      )}

      {shown.map((u) => (
        <UserCard key={u.uid} u={u} self={u.uid === self} busy={busy === u.uid} run={run} auth={auth} />
      ))}

      {snap.orphanSessions.length > 0 && (
        <section className="pf-sec">
          <h2 className="sec-title">প্রোফাইলহীন সেশন</h2>
          <p className="fineprint">
            এই অ্যাকাউন্টগুলো Authentication থেকে মুছে ফেলা হয়েছে, কিন্তু সেশন ডকুমেন্ট রয়ে গেছে।
          </p>
          {snap.orphanSessions.map((s) => (
            <div className="card" key={s.uid} style={{ marginBottom: 10 }}>
              <div className="row" style={{ borderBottom: 0, padding: 0 }}>
                <span className="nm fineprint">{s.uid}</span>
                <span className="val">{when(s.since)} · {shortDevice(s.device)}</span>
                <button type="button" className="ghost" disabled={busy === s.uid} onClick={() => run(s.uid, () => auth.admin.signOutDevice(s.uid))}>
                  মুছুন
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function UserCard({ u, self, busy, run, auth }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.name ?? "");

  async function saveName(e) {
    e.preventDefault();
    if (await run(u.uid, () => auth.admin.setName(u.uid, name))) setEditing(false);
  }

  return (
    <div className="card user-card" style={{ opacity: u.disabled ? 0.6 : 1 }}>
      <div className="row" style={{ borderBottom: 0, paddingTop: 0 }}>
        <div className="nm">
          {editing ? (
            <form onSubmit={saveName} style={{ display: "flex", gap: 8 }}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ flex: 1 }} />
              <button type="submit" className="ghost" disabled={busy}>সেভ</button>
              <button type="button" className="linky" onClick={() => { setEditing(false); setName(u.name ?? ""); }}>বাতিল</button>
            </form>
          ) : (
            <>
              <b>{u.name || "নাম নেই"}</b>
              {self && <span className="fineprint"> (আপনি)</span>}
              <button type="button" className="linky" style={{ marginLeft: 8 }} onClick={() => setEditing(true)} disabled={busy}>
                নাম বদলান
              </button>
            </>
          )}
          <div className="fineprint" style={{ marginTop: 2 }}>
            {[u.email, u.phone].filter(Boolean).join(" · ") || "—"}
            {" · "}
            <button type="button" className="linky" title="uid কপি করুন" onClick={() => navigator.clipboard?.writeText(u.uid)}>
              uid কপি
            </button>
          </div>
        </div>
        <span className="chip" aria-pressed={u.plan === "full"}>{u.plan === "full" ? "পুরো ব্যাংক" : "গেস্ট"}</span>
        {u.isAdmin && <span className="chip" aria-pressed="true">অ্যাডমিন</span>}
        {u.disabled && <span className="chip">বন্ধ</span>}
      </div>

      <div className="row">
        <span className="nm">রেজিস্টার</span>
        <span className="val">{when(u.createdAt)}</span>
      </div>
      <div className="row">
        <span className="nm">লগইন</span>
        <span className="val" title={u.session?.device}>
          {u.session ? `${when(u.session.since)} · ${shortDevice(u.session.device)}` : "লগইন নেই"}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="ghost" disabled={busy} onClick={() => run(u.uid, () => auth.admin.setPlan(u.uid, u.plan === "full" ? "guest" : "full"))}>
          {u.plan === "full" ? "গেস্ট করুন" : "পুরো ব্যাংক খুলুন"}
        </button>
        <button type="button" className="ghost" disabled={busy || !u.session} onClick={() => run(u.uid, () => auth.admin.signOutDevice(u.uid))}>
          ডিভাইস থেকে সাইন আউট
        </button>
        <button type="button" className={u.disabled ? "ghost" : "linky"} disabled={busy || self} onClick={() => run(u.uid, () => auth.admin.setDisabled(u.uid, !u.disabled))}>
          {u.disabled ? "অ্যাকাউন্ট চালু করুন" : "অ্যাকাউন্ট বন্ধ করুন"}
        </button>
        <button
          type="button"
          className="linky danger"
          disabled={busy || self}
          onClick={() => {
            if (window.confirm(`${u.name || u.phone || u.email || u.uid}-এর প্রোফাইল মুছবেন? Authentication থেকে অ্যাকাউন্টটি আগে মুছে ফেলুন, নইলে পরের লগইনে প্রোফাইল আবার তৈরি হবে।`)) {
              run(u.uid, async () => {
                if (u.session) await auth.admin.signOutDevice(u.uid);
                await auth.admin.deleteProfile(u.uid);
              });
            }
          }}
        >
          প্রোফাইল মুছুন
        </button>
      </div>
    </div>
  );
}
