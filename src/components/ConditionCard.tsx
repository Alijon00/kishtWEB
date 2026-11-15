import CachedBadge from "./CachedBadge";

type Tone = "good" | "warn" | "neutral";

interface ConditionCardProps {
  title: string;
  lead: string;
  stat?: string;
  tone?: Tone;
  source: string;
  cached?: boolean;
}

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
