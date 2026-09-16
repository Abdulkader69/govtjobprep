import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DEMO_BAND, DEMO_COUNT } from "@/lib/constants.js";

/**
 * The demo paper: fixed length, no sign-in, straight into the exam.
 * A visitor should not have to make three choices before seeing what the app is.
 */
export default function Demo({ attempt, auth }) {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    attempt
      .start({ band: DEMO_BAND, count: DEMO_COUNT, shuffle: true, unlocked: auth.unlocked })
      .then(() => navigate("/exam", { replace: true }))
      .catch(() => navigate("/", { replace: true }));
  }, [attempt, auth.unlocked, navigate]);

  return (
    <div className="wrap">
      <div className="state">ডেমো পরীক্ষা তৈরি হচ্ছে…</div>
    </div>
  );
}
