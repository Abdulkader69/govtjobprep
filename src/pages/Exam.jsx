import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import { Navigate, useNavigate } from "react-router-dom";
import ExamBar from "@/components/ExamBar.jsx";
import OptionList from "@/components/OptionList.jsx";
import QuestionGrid from "@/components/QuestionGrid.jsx";
import ConfirmSubmit from "@/components/ConfirmSubmit.jsx";
import { useCountdown } from "@/lib/useCountdown.js";
import { usePerPage, pageStart } from "@/lib/usePerPage.js";
import { SUBJECT_LABEL } from "@/lib/constants.js";
import { bn } from "@/lib/bn.js";

export default function Exam({ attempt, auth }) {
  const navigate = useNavigate();
  // `index` is the first question on the current page, not a question cursor.
  const [index, setIndex] = useState(0);
  const perPage = usePerPage();
  const [showGrid, setShowGrid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);

  const { attempt: data, answers, status } = attempt;

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    setIndex((i) => pageStart(i, perPage));
  }, [perPage]);

  const finish = useCallback(
    async (auto) => {
      setConfirming(false);
      setShowGrid(false);
      await attempt.submit({ auto });
      navigate("/result", { replace: true });
    },
    [attempt, navigate]
  );

  const onExpire = useCallback(() => { finish(true); }, [finish]);
  const left = useCountdown(data?.expiresAt ?? null, onExpire);

  // Warn on tab close, but only while the attempt is still live.
  useEffect(() => {
    if (!data || status === "done") return undefined;
    const guard = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [data, status]);

  // Redirecting while the restore is still in flight would throw away an exam
  // that a reload was about to bring back.
  if (attempt.restoring) {
    return (
      <>
        <SiteHeader auth={auth} minimal />
        <div className="wrap"><div className="state">পরীক্ষা ফিরিয়ে আনা হচ্ছে…</div></div>
        <SiteFooter auth={auth} />
      </>
    );
  }
  if (!data) return <Navigate to="/" replace />;

  const questions = data.questions;
  const answered = Object.keys(answers).length;
  const start = Math.min(index, Math.max(0, questions.length - 1));
  const shown = questions.slice(start, start + perPage);
  const isLastPage = start + perPage >= questions.length;

  function goTo(next) {
    setIndex(pageStart(next, perPage, questions.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <SiteHeader auth={auth} minimal />
      <ExamBar
        left={left}
        from={start + 1}
        to={Math.min(start + perPage, questions.length)}
        total={questions.length}
        answered={answered}
        offline={offline}
        onOpenGrid={() => setShowGrid(true)}
      />

      <div className="wrap">
        <ol className="qpage" start={start + 1}>
          {shown.map((item, i) => (
            <li className="qblock" key={item.id} id={`q-${start + i + 1}`}>
              <div className="qhead">{item.topic} · {SUBJECT_LABEL[item.subject]}</div>
              <h2 className="stem">
                {bn(start + i + 1)}. {item.stem}
              </h2>
              <OptionList
                question={item}
                picked={answers[item.id]}
                onPick={(option) => attempt.answer(item.id, option)}
              />
            </li>
          ))}
        </ol>

        <div className="nav">
          <button type="button" disabled={start === 0} onClick={() => goTo(start - perPage)}>
            আগের
          </button>
          {!isLastPage ? (
            <button type="button" className="primary" onClick={() => goTo(start + perPage)}>
              পরের
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => setConfirming(true)}>
              জমা দিন
            </button>
          )}
        </div>
      </div>

      {showGrid && (
        <QuestionGrid
          questions={questions}
          answers={answers}
          index={start}
          perPage={perPage}
          onJump={(i) => { goTo(i); setShowGrid(false); }}
          onClose={() => setShowGrid(false)}
          onSubmit={() => { setShowGrid(false); setConfirming(true); }}
        />
      )}

      <SiteFooter auth={auth} />

      {confirming && (
        <ConfirmSubmit
          blank={questions.length - answered}
          left={left}
          busy={status === "submitting"}
          onCancel={() => setConfirming(false)}
          onConfirm={() => finish(false)}
        />
      )}
    </>
  );
}
