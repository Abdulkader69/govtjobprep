import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import { loadBank } from "@/lib/bank.js";
import { bankBreakdown, usageEstimate, adminWarnings } from "@/lib/adminStats.js";
import Overview from "./admin/Overview.jsx";
import Users from "./admin/Users.jsx";
import Bank from "./admin/Bank.jsx";

const TABS = [
  ["overview", "সারসংক্ষেপ"],
  ["users", "ব্যবহারকারী"],
  ["bank", "প্রশ্নব্যাংক"],
];

/**
 * Super-admin console. Three tabs over one snapshot of Firestore:
 * an overview (warnings, headline numbers, usage against the free tier),
 * the user list with every action an admin has, and the question bank.
 *
 * firestore.rules is what makes these actions admin-only; the redirect
 * below is cosmetic.
 */
export default function Admin({ auth }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "overview";

  const [snap, setSnap] = useState(null); // { users, admins, orphanSessions, bank }
  const [banks, setBanks] = useState(null); // { full, guest }
  const [error, setError] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, guest, full] = await Promise.all([
        auth.admin.snapshot(),
        loadBank(false),
        loadBank(true).catch(() => null),
      ]);
      setSnap(s);
      setBanks({ full, guest });
      setLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err?.code === "permission-denied" ? "আপনার অ্যাডমিন অনুমতি নেই।" : "তথ্য আনা যায়নি।");
    }
  }, [auth.admin]);

  useEffect(() => {
    if (auth.user?.isAdmin) load();
  }, [auth.user?.isAdmin, load]);

  const stats = useMemo(() => {
    if (!snap || !banks) return null;
    const bank = banks.full ? bankBreakdown(banks.full, banks.guest) : null;
    const usage = usageEstimate({ users: snap.users, orphanSessions: snap.orphanSessions.length, bankBytes: bank?.bytes ?? 0 });
    const warnings = adminWarnings({
      bank,
      usage,
      deployedVersion: banks.guest?.meta?.version,
      uploadedVersion: snap.bank?.version,
      deployedAt: banks.guest?.meta?.generated_at,
      uploadedAt: snap.bank?.generatedAt,
      bankMissing: !snap.bank,
      orphanSessions: snap.orphanSessions.length,
      disabledCount: snap.users.filter((u) => u.disabled).length,
    });
    return { bank, usage, warnings };
  }, [snap, banks]);

  if (auth.ready && !auth.user) return <Navigate to="/login?next=/admin" replace />;
  if (auth.ready && auth.user && !auth.user.isAdmin) return <Navigate to="/" replace />;

  /** Run an admin action, then refresh; surfaces a message on failure. */
  async function act(fn) {
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(
        err?.code === "permission-denied"
          ? "অনুমতি নেই — firestore.rules সর্বশেষ সংস্করণে প্রকাশ করা আছে কি?"
          : "পরিবর্তনটি সেভ হয়নি। আবার চেষ্টা করুন।"
      );
      return false;
    }
  }

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap prep admin">
        <div className="hero hero-row" style={{ padding: "34px 0 6px" }}>
          <div>
            <h1 style={{ fontSize: 28 }}>অ্যাডমিন</h1>
            <p>
              {snap
                ? `${loadedAt ? new Date(loadedAt).toLocaleTimeString("bn-BD", { timeStyle: "short" }) : ""}-এ আনা তথ্য।`
                : "তথ্য আনা হচ্ছে…"}
            </p>
          </div>
          <button type="button" className="ghost hero-cta" onClick={load} disabled={!snap}>
            ↻ রিফ্রেশ
          </button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className="tab"
              onClick={() => setParams(k === "overview" ? {} : { tab: k }, { replace: true })}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="banner" role="alert" style={{ marginTop: 0, marginBottom: 18 }}>
            {error}
          </div>
        )}

        {!snap || !stats ? (
          <div className="state">লোড হচ্ছে…</div>
        ) : tab === "users" ? (
          <Users snap={snap} self={auth.user.uid} auth={auth} act={act} />
        ) : tab === "bank" ? (
          <Bank snap={snap} banks={banks} stats={stats} />
        ) : (
          <Overview snap={snap} banks={banks} stats={stats} auth={auth} />
        )}
      </div>
      <SiteFooter auth={auth} />
    </>
  );
}
