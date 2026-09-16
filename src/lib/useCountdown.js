import { useEffect, useState } from "react";

/**
 * Remaining seconds derived from a fixed deadline, never decremented.
 *
 * A backgrounded tab or a sleeping phone throttles setInterval, so counting
 * down by one per tick quietly hands the candidate extra minutes. Recomputing
 * from the deadline also means returning from a phone call shows the true
 * remaining time immediately.
 *
 * @param {number|null} deadlineMs epoch ms, or null to stop the clock
 * @param {() => void} onExpire fired once when the deadline passes
 */
export function useCountdown(deadlineMs, onExpire) {
  const [left, setLeft] = useState(() => remaining(deadlineMs));

  useEffect(() => {
    if (!deadlineMs) return undefined;
    let fired = false;

    const tick = () => {
      const secs = remaining(deadlineMs);
      setLeft(secs);
      if (secs === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadlineMs, onExpire]);

  return left;
}

function remaining(deadlineMs) {
  if (!deadlineMs) return 0;
  return Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
}
