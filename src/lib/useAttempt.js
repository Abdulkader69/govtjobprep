import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";

/**
 * Owns one exam attempt: the paper, the chosen answers, and the save queue.
 *
 * Answers are held in React state immediately so the UI never waits on the
 * network, and pushed to the server in the background. A failed push is
 * retried, because a candidate on a flaky connection who loses their answers
 * does not come back.
 */
export function useAttempt() {
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  // "restoring" covers the moment before we know whether an exam is in
  // progress — without it the Exam page would bounce to home on every reload.
  const [status, setStatus] = useState("restoring"); // restoring | idle | loading | ready | submitting | done
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(0);

  const queue = useRef([]);
  const draining = useRef(false);
  const submitted = useRef(false);

  // Pick up an exam left open by a reload or a killed tab.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await api.resumeAttempt?.();
        if (cancelled) return;
        if (live?.attempt) {
          submitted.current = false;
          queue.current = [];
          setPending(0);
          setAnswers(live.answers ?? {});
          setAttempt(live.attempt);
          setStatus("ready");
          return;
        }
      } catch {
        // No resumable attempt, or storage is unavailable. Start fresh.
      }
      if (!cancelled) setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const drain = useCallback(async () => {
    if (draining.current || !queue.current.length) return;
    draining.current = true;
    while (queue.current.length) {
      const job = queue.current[0];
      try {
        await api.saveAnswer(job);
        queue.current.shift();
        setPending(queue.current.length);
      } catch {
        // Leave it queued and back off; a later answer or submit retries it.
        break;
      }
    }
    draining.current = false;
  }, []);

  useEffect(() => {
    const retry = () => drain();
    window.addEventListener("online", retry);
    const id = setInterval(retry, 15000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(id);
    };
  }, [drain]);

  const start = useCallback(async ({ band, shuffle, count, subjects, topics, unlocked }) => {
    setStatus("loading");
    setError(null);
    try {
      const data = await api.startAttempt({ band, shuffle, count, subjects, topics, unlocked });
      submitted.current = false;
      queue.current = [];
      setPending(0);
      setAnswers({});
      setResult(null);
      setAttempt(data);
      setStatus("ready");
      return data;
    } catch (e) {
      setError(e);
      setStatus("idle");
      throw e;
    }
  }, []);

  const answer = useCallback(
    (questionId, option) => {
      setAnswers((prev) => {
        // Tapping the selected option again clears it, which matters when
        // negative marking makes a blank safer than a guess.
        const next = { ...prev };
        if (next[questionId] === option) delete next[questionId];
        else next[questionId] = option;

        queue.current = queue.current.filter((j) => j.questionId !== questionId);
        queue.current.push({
          attemptId: attempt?.attemptId,
          questionId,
          option: next[questionId] ?? null,
        });
        setPending(queue.current.length);
        return next;
      });
      drain();
    },
    [attempt, drain]
  );

  const submit = useCallback(
    async ({ auto = false } = {}) => {
      if (submitted.current) return result;
      submitted.current = true;
      setStatus("submitting");
      await drain();
      try {
        const data = await api.submitAttempt({ attemptId: attempt.attemptId, auto });
        setResult(data);
        setStatus("done");
        return data;
      } catch (e) {
        submitted.current = false;
        setError(e);
        setStatus("ready");
        throw e;
      }
    },
    [attempt, drain, result]
  );

  const discard = useCallback(async () => {
    try {
      await api.discardAttempt?.();
    } catch {
      /* nothing to clean up */
    }
    queue.current = [];
    submitted.current = false;
    setPending(0);
    setAnswers({});
    setAttempt(null);
    setResult(null);
    setStatus("idle");
  }, []);

  return {
    attempt, answers, status, error, result, pending,
    restoring: status === "restoring",
    start, answer, submit, discard,
  };
}
