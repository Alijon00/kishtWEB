import type { Plan } from "../lib/rotation/types";
import type { Crop } from "../data/crops";
import { groupSlotsByYear } from "../lib/rotation/engine";
import { cropName, useI18n } from "../i18n";
import { cropLookById } from "../lib/cropLook";
import ScoreBar from "./ScoreBar";

const LESS_WATER_SCORE = 7.5;

interface PlanCardProps {
  plan: Plan;
  onSeeEvidence?: () => void;
}

const relTone = (status: Plan["reliabilityStatus"]) =>
  status === "holds" ? "down" : status === "high-risk" ? "up" : "neutral";

export default function PlanCard({ plan, onSeeEvidence }: PlanCardProps) {
  const { d } = useI18n();
  const title = d.planTitle[plan.id as keyof typeof d.planTitle] ?? plan.title;
  const tropical = plan.seasonKind === "tropical";
  const summerLabel = tropical ? d.rotation.seasonLong : d.rotation.seasonSummer;
  const winterLabel = tropical ? d.rotation.seasonShort : d.rotation.seasonWinter;

  const planted = plan.slots.map((s) => s.crop).filter((c): c is Crop => c != null);
  const distinctCrops = new Set(planted.map((c) => c.id)).size;
  const families = new Set(planted.map((c) => c.family)).size;
  const hasLegume = planted.some((c) => c.fixesNitrogen);
  const why =
    plan.id === "current"
      ? d.planBlurb.now({ crops: distinctCrops, families, hasLegume })
      : d.planBlurb.kisht({ families, hasLegume, lessWater: plan.scores.water >= LESS_WATER_SCORE });

  return (
    <div className="card plan-card">
      <div className="plan-head">
        <h3 className="plan-title">
          {title}
          {plan.id === "best-fit" && <span className="badge">★</span>}
        </h3>
        <span className={`tag ${relTone(plan.reliabilityStatus)}`}>
          {d.reliabilityLabel[plan.reliabilityStatus]}
        </span>
      </div>

      <div className="years-row">
        {groupSlotsByYear(plan.slots).map((yr) => (
          <div className="year-chip" key={yr.year}>
            <span className="year-num mono">{yr.year}</span>
            <span className="year-slot" title={summerLabel}>
              <span className="season-ico" aria-hidden>{tropical ? "🌧" : "☀"}</span>
              <span
                className={"year-crop" + (yr.summer ? "" : " fallow")}
                data-crop={yr.summer ? cropLookById(yr.summer.id) : undefined}
              >
                {yr.summer ? cropName(d, yr.summer.id) : d.rotation.fallow}
              </span>
            </span>
            <span className="year-slot" title={winterLabel}>
              <span className="season-ico" aria-hidden>{tropical ? "🌦" : "❄"}</span>
              <span
                className={"year-crop" + (yr.winter ? "" : " fallow")}
                data-crop={yr.winter ? cropLookById(yr.winter.id) : undefined}
              >
                {yr.winter ? cropName(d, yr.winter.id) : d.rotation.fallow}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="plan-scores">
        <ScoreBar label={d.rotation.scoreWater} score={plan.scores.water} />
        <ScoreBar label={d.rotation.scoreSoil} score={plan.scores.soil} />
        <ScoreBar label={d.rotation.scoreIncome} score={plan.scores.income} />
        <ScoreBar label={d.rotation.scoreReliability} score={plan.scores.reliability} />
      </div>

      <p className="plan-why">{why}</p>

      <div className="plan-foot">
        <span className="plan-match mono">{d.rotation.match({ pct: plan.matchPct })}</span>
        {onSeeEvidence && (
          <button type="button" className="btn btn-small" onClick={onSeeEvidence}>
            {d.rotation.seeEvidence}
          </button>
        )}
      </div>
    </div>
  );
}
