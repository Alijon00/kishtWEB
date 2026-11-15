import { useI18n } from "../i18n";

/** A labelled 0–10 score as a horizontal bar with a worded level (no raw number). */
export default function ScoreBar({ label, score }: { label: string; score: number }) {
  const { d } = useI18n();
  const pct = Math.max(0, Math.min(100, score * 10));
  const tone = score < 2.5 ? "low" : score < 5 ? "fair" : score < 7.5 ? "good" : "strong";
  const word =
    tone === "low"
      ? d.scoreWord.low
      : tone === "fair"
        ? d.scoreWord.fair
        : tone === "good"
          ? d.scoreWord.good
          : d.scoreWord.strong;
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <span className="score-track">
        <span className={`score-fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`score-val tone-${tone}`}>{word}</span>
    </div>
  );
}
