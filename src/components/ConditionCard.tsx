import CachedBadge from "./CachedBadge";

type Tone = "good" | "warn" | "neutral";

interface ConditionCardProps {
  title: string;
  /** Plain-language sentence — the main content of the card. */
  lead: string;
  /** Short headline figure (e.g. "+0.6 °C · −8%"), optional. */
  stat?: string;
  tone?: Tone;
  source: string;
  cached?: boolean;
}

/**
 * A plain-language "what your field is dealing with" card for screen 2. One
 * short sentence plus an optional headline figure and the data source — no
 * jargon, no charts.
 */
export default function ConditionCard({
  title,
  lead,
  stat,
  tone = "neutral",
  source,
  cached,
}: ConditionCardProps) {
  return (
    <div className="card condition-card">
      <div className="condition-head">
        <span className="condition-title">{title}</span>
        {stat && <span className={`condition-stat mono tone-${tone}`}>{stat}</span>}
      </div>
      <p className="condition-lead">{lead}</p>
      <div className="source">
        {source}
        {cached && <CachedBadge />}
      </div>
    </div>
  );
}
