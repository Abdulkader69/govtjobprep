import { letters } from "@/lib/constants.js";

/**
 * The OMR bubble row. In `review` mode it marks the key and, if the candidate
 * was wrong, their choice — so the two are visible side by side.
 */
export default function OptionList({ question, picked, onPick, review = false }) {
  const marks = letters(question.subject);

  return (
    <div className="opts">
      {question.options.map((text, i) => {
        if (review) {
          const cls =
            i === question.answer ? "opt correct" : picked === i ? "opt wrong" : "opt";
          return (
            <div key={i} className={cls}>
              <span className="bubble">{marks[i]}</span>
              <span>{text}</span>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            className="opt"
            aria-pressed={picked === i}
            onClick={() => onPick(i)}
          >
            <span className="bubble" aria-hidden="true">{marks[i]}</span>
            <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}
