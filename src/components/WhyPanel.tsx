import { groupSlotsByYear } from "../lib/rotation/engine";
import { waterNeedMid, type Crop } from "../data/crops";
import type { Band } from "../data/crops";
import type { EngineResult, PlanSlot } from "../lib/rotation/types";
import { cropName, renderReason, useI18n } from "../i18n";
import { cropLookById } from "../lib/cropLook";
import { usePlan } from "../state/plan";

interface WhyPanelProps {
  result: EngineResult;
}

function planCrops(slots: PlanSlot[]): Crop[] {
  const seen = new Set<string>();
  const out: Crop[] = [];
  for (const s of slots) {
    if (s.crop && !seen.has(s.crop.id)) {
      seen.add(s.crop.id);
      out.push(s.crop);
    }
  }
  return out;
}

export default function WhyPanel({ result }: WhyPanelProps) {
  const { d } = useI18n();
  const { whyPlanId, setWhyPlanId } = usePlan();

  const plans = result.plans;
  if (plans.length === 0) return null;
  const selected = plans.find((p) => p.id === whyPlanId) ?? plans[0];
  const crops = planCrops(selected.slots);

  return (
    <div className="why-panel">
      {}
      <div className="why-pick">
        <span className="why-pick-label">{d.why.explaining}:</span>
        <div className="seg" role="group" aria-label={d.why.explaining}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"seg-btn" + (p.id === selected.id ? " active" : "")}
              aria-pressed={p.id === selected.id}
              onClick={() => setWhyPlanId(p.id)}
            >
              {d.planTitle[p.id as keyof typeof d.planTitle] ?? p.title}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="years-row why-years">
        {groupSlotsByYear(selected.slots).map((yr) => {
          const tropical = selected.seasonKind === "tropical";
          return (
            <div className="year-chip" key={yr.year}>
              <span className="year-num mono">{yr.year}</span>
              <span className="year-slot" title={tropical ? d.rotation.seasonLong : d.rotation.seasonSummer}>
                <span className="season-ico" aria-hidden>{tropical ? "🌧" : "☀"}</span>
                <span
                  className={"year-crop" + (yr.summer ? "" : " fallow")}
                  data-crop={yr.summer ? cropLookById(yr.summer.id) : undefined}
                >
                  {yr.summer ? cropName(d, yr.summer.id) : d.rotation.fallow}
                </span>
              </span>
              <span className="year-slot" title={tropical ? d.rotation.seasonShort : d.rotation.seasonWinter}>
                <span className="season-ico" aria-hidden>{tropical ? "🌦" : "❄"}</span>
                <span
                  className={"year-crop" + (yr.winter ? "" : " fallow")}
                  data-crop={yr.winter ? cropLookById(yr.winter.id) : undefined}
                >
                  {yr.winter ? cropName(d, yr.winter.id) : d.rotation.fallow}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {}
      <div className="card panel-block">
        <h2 className="block-h">{d.why.chainHeading}</h2>
        <div className="table-scroll">
          <table className="why-table">
            <thead>
              <tr>
                <th>{d.why.colData}</th>
                <th>{d.why.colSource}</th>
                <th>{d.why.colRule}</th>
                <th>{d.why.colEffect}</th>
              </tr>
            </thead>
            <tbody>
              {selected.reasons.map((r, i) => {
                const rr = renderReason(d, r);
                return (
                  <tr key={i}>
                    <td className="mono">{rr.dataPoint}</td>
                    <td>
                      <span className="src-pill">{rr.source}</span>
                    </td>
                    <td>{rr.rule}</td>
                    <td>{rr.effect}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="card panel-block">
        <h2 className="block-h">{d.why.needsHeading}</h2>
        <div className="table-scroll">
          <table className="why-table needs-table">
            <thead>
              <tr>
                <th>{d.why.needsCrop}</th>
                <th>{d.why.needsWater}</th>
                <th>{d.why.needsHeat}</th>
                <th>{d.why.needsNitrogen}</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id}>
                  <td>{cropName(d, c.id)}</td>
                  <td className="mono">
                    {c.waterNeedMm[0]}–{c.waterNeedMm[1]} {d.common.mm}
                    <span className="needs-sub mono"> · ~{Math.round(waterNeedMid(c))}</span>
                  </td>
                  <td>{d.band[String(c.heatTolerance) as `${Band}`]}</td>
                  <td>{c.fixesNitrogen ? d.yes : d.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="source">{d.why.needsCaption}</div>
      </div>

      {}
      <div className="card panel-block limits-card">
        <h2 className="block-h">{d.why.limitsHeading}</h2>
        <ul className="limits-list">
          <li>{d.why.limitPrices}</li>
          <li>{d.why.limitPests}</li>
          <li>{d.why.limitWater}</li>
          <li>{d.why.limitSalinity}</li>
          <li>{d.why.limitResolution}</li>
        </ul>
        <p className="limits-conclusion">{d.why.limitConclusion}</p>
      </div>

      {}
      <div className="card panel-block">
        <h2 className="block-h">{d.why.sourcesHeading}</h2>
        <ul className="sources-list">
          {Object.values(d.sources).map((s) => (
            <li key={s.name} className="source-item">
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
              <span className="source-desc">{s.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
