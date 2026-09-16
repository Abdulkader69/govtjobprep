import { bn, clock } from "@/lib/bn.js";

export default function ConfirmSubmit({ blank, left, busy, onCancel, onConfirm }) {
  return (
    <div className="modal" onClick={onCancel}>
      <div className="modal-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>খাতা জমা দেবেন?</h3>
        <p>
          {blank > 0
            ? `${bn(blank)}টি প্রশ্নের উত্তর এখনও দেওয়া হয়নি। হাতে সময় আছে ${clock(left)}।`
            : `সব প্রশ্নের উত্তর দেওয়া হয়েছে। হাতে সময় আছে ${clock(left)}।`}{" "}
          জমা দেওয়ার পর উত্তর বদলানো যাবে না।
        </p>
        <div className="nav">
          <button type="button" onClick={onCancel} disabled={busy}>ফিরে যান</button>
          <button type="button" className="primary" onClick={onConfirm} disabled={busy}>
            {busy ? "জমা হচ্ছে…" : "জমা দিন"}
          </button>
        </div>
      </div>
    </div>
  );
}
