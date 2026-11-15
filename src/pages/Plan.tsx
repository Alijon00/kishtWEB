import { useMemo, useState } from "react";
import PlanCard from "../components/PlanCard";
import CachedBadge from "../components/CachedBadge";
import WhyPanel from "../components/WhyPanel";
import NasaDataBlock from "../components/NasaDataBlock";
import { buildPlans, buildCurrentPlan } from "../lib/rotation/engine";
import { CROPS } from "../data/crops";
import type { Priorities as Weights, Scenario } from "../lib/rotation/types";
import { cropName, useI18n } from "../i18n";
import { usePlan, defaultCurrentRotation } from "../state/plan";
import { useField, fieldLabel } from "../state/field";
import { useSiteConditions } from "../state/useSiteConditions";

interface PlanProps {
  onPickField: () => void;
}

const SUMMER_CROPS = CROPS.filter((c) => c.season === "summer");
const WINTER_CROPS = CROPS.filter((c) => c.season === "winter");

/** "What matters most?" presets → priority weights (engine untouched). */
const PRIORITY_PRESETS = {
  balanced: { water: 5, soil: 5, income: 5, reliability: 5 },
  water: { water: 9, soil: 5, income: 3, reliability: 6 },
  soil: { water: 5, soil: 9, income: 3, reliability: 5 },
  income: { water: 4, soil: 4, income: 9, reliability: 4 },
  reliable: { water: 6, soil: 5, income: 3, reliability: 9 },
} as const;
type PresetKey = keyof typeof PRIORITY_PRESETS;
const PRESET_KEYS = Object.keys(PRIORITY_PRESETS) as PresetKey[];
const matchingPreset = (p: Weights): PresetKey | null =>
  PRESET_KEYS.find((k) => {
    const v = PRIORITY_PRESETS[k];
    return (
      v.water === p.water &&
      v.soil === p.soil &&
      v.income === p.income &&
      v.reliability === p.reliability
    );
  }) ?? null;

type ScenKey = "now" | "dry" | "hot" | "both";
const SCENARIOS: Record<ScenKey, Scenario> = {
  now: { rainDeltaPct: 0, tempDeltaC: 0 },
  dry: { rainDeltaPct: -20, tempDeltaC: 0 },
  hot: { rainDeltaPct: 0, tempDeltaC: 2 },
  both: { rainDeltaPct: -20, tempDeltaC: 2 },
};
const scenKey = (s: Scenario): ScenKey =>
  s.rainDeltaPct !== 0 && s.tempDeltaC !== 0
    ? "both"
    : s.rainDeltaPct !== 0
      ? "dry"
      : s.tempDeltaC !== 0
        ? "hot"
        : "now";

/**
 * Step 3 — "Your next four years". Segmented "What matters most?" presets, a
 * "Test the future" scenario switch, "Now vs Kisht" side by side with worded
 * score bars and the season grid, then a collapsible "Why this plan". Controls
 * only reshape the inputs; the engine and data are untouched.
 */
export default function Plan({ onPickField }: PlanProps) {
  const { d } = useI18n();
  const { field } = useField();
  const {
    priorities,
    setPriority,
    selectable,
    toggleCrop,
    setAllCrops,
    currentRotation,
    setCurrentRotation,
    scenario,
    setScenario,
    setWhyPlanId,
  } = usePlan();
  const bundle = useSiteConditions(field?.lat ?? null, field?.lon ?? null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const result = useMemo(() => {
    if (!bundle.site) return null;
    return buildPlans(bundle.site, priorities, scenario, selectable);
  }, [bundle.site, priorities, scenario, selectable]);

  const currentPlan = useMemo(() => {
    if (!bundle.site || field == null) return null;
    const rotation = currentRotation ?? defaultCurrentRotation(field.lat, field.lon);
    return buildCurrentPlan(bundle.site, priorities, scenario, rotation);
  }, [bundle.site, field, priorities, scenario, currentRotation]);

  if (!field) {
    return (
      <section>
        <div className="screen-head">
          <h1>{d.plan.title}</h1>
        </div>
        <div className="card state">
          <h2>{d.common.pickFieldFirst}</h2>
          <p>{d.common.pickFieldHint}</p>
          <button className="btn" onClick={onPickField}>
            {d.common.pickFieldBtn}
          </button>
        </div>
      </section>
    );
  }

  const activePreset = matchingPreset(priorities);
  const applyPreset = (k: PresetKey) => {
    const v = PRIORITY_PRESETS[k];
    (Object.keys(v) as (keyof Weights)[]).forEach((key) => setPriority(key, v[key]));
  };

  const tooFew = selectable.size < 4;
  const current = currentRotation ?? defaultCurrentRotation(field.lat, field.lon);
  const setSeason = (season: "summer" | "winter", id: string) =>
    setCurrentRotation({ ...current, [season]: id === "" ? null : id });
  const tropical = Math.abs(field.lat) <= 23.5;
  const summerSeasonLabel = tropical ? d.rotation.seasonLong : d.current.summerLabel;
  const winterSeasonLabel = tropical ? d.rotation.seasonShort : d.current.winterLabel;

  // --- "What matters most?" + collapsible crop/rotation controls ------------
  const controls = (
    <>
      <div className="card panel-block matters">
        <h2 className="block-h">{d.plan.mattersHeading}</h2>
        <div className="seg" role="group" aria-label={d.plan.mattersHeading}>
          {PRESET_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={"seg-btn" + (activePreset === k ? " active" : "")}
              aria-pressed={activePreset === k}
              onClick={() => applyPreset(k)}
            >
              {d.plan.presets[k]}
            </button>
          ))}
        </div>
      </div>

      <details className="plan-controls">
        <summary className="plan-controls-summary">
          <span className="block-h">{d.plan.adjustHeading}</span>
          <span className="plan-controls-meta mono">
            {d.priorities.selected({ n: selectable.size, total: CROPS.length })}
          </span>
        </summary>

        <div className="plan-controls-split">
          <div>
            <h3 className="block-h">{d.current.heading}</h3>
            <p className="slider-desc">{d.current.hint}</p>
            <div className="current-grid">
              <label className="current-field">
                <span className="current-label">{summerSeasonLabel}</span>
                <select
                  className="current-select"
                  value={current.summer ?? ""}
                  onChange={(e) => setSeason("summer", e.target.value)}
                >
                  <option value="">{d.current.fallow}</option>
                  {SUMMER_CROPS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {cropName(d, c.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="current-field">
                <span className="current-label">{winterSeasonLabel}</span>
                <select
                  className="current-select"
                  value={current.winter ?? ""}
                  onChange={(e) => setSeason("winter", e.target.value)}
                >
                  <option value="">{d.current.fallow}</option>
                  {WINTER_CROPS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {cropName(d, c.id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="crop-select">
            <div className="crop-select-head">
              <h3 className="block-h">{d.priorities.cropsHeading}</h3>
              <div className="select-actions">
                <button className="chip-btn" onClick={() => setAllCrops(true)}>
                  {d.priorities.all}
                </button>
                <button className="chip-btn" onClick={() => setAllCrops(false)}>
                  {d.priorities.none}
                </button>
              </div>
            </div>
            <div className="crop-grid">
              {CROPS.map((c) => {
                const on = selectable.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={"crop-chk" + (on ? " on" : "")}
                    aria-pressed={on}
                    onClick={() => toggleCrop(c.id)}
                  >
                    <span className="crop-box" aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                    {cropName(d, c.id)}
                  </button>
                );
              })}
            </div>
            {tooFew && <span className="panel-msg">{d.priorities.tooFew}</span>}
          </div>
        </div>
      </details>
    </>
  );

  const scenarioToggle = (
    <div className="card panel-block whatif">
      <div className="whatif-head">
        <h2 className="block-h">{d.plan.testFutureHeading}</h2>
        <p className="slider-desc">{d.rotation.whatIfHint}</p>
      </div>
      <div className="seg" role="group" aria-label={d.plan.testFutureHeading}>
        {(Object.keys(SCENARIOS) as ScenKey[]).map((k) => {
          const label =
            k === "now"
              ? d.rotation.scenarioNow
              : k === "dry"
                ? d.rotation.scenarioDry
                : k === "hot"
                  ? d.rotation.scenarioHot
                  : d.rotation.scenarioBoth;
          return (
            <button
              key={k}
              type="button"
              className={"seg-btn" + (scenKey(scenario) === k ? " active" : "")}
              aria-pressed={scenKey(scenario) === k}
              onClick={() => setScenario(SCENARIOS[k])}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section>
      <div className="screen-head">
        <h1>{d.plan.title}</h1>
        <div className="subtitle">
          {d.plan.subtitle} · {fieldLabel(field)}
          {bundle.cached && <CachedBadge />}
        </div>
      </div>

      {controls}

      {bundle.status === "loading" && (
        <div className="card state">
          <div className="spinner" />
          <h2>{d.common.loading}</h2>
          <p>{d.common.loadingSub}</p>
        </div>
      )}

      {bundle.status === "error" && (
        <div className="card state">
          <h2>{d.common.error}</h2>
          <p>{d.common.errorSub}</p>
          {bundle.climateError && <div className="source">{bundle.climateError}</div>}
          <button className="btn" onClick={bundle.reloadClimate}>
            {d.common.tryAgain}
          </button>
        </div>
      )}

      {bundle.status === "ready" && bundle.site && result && (
        <>
          {scenarioToggle}

          {bundle.grace.status === "ready" &&
            bundle.grace.result?.category === "falling" && (
              <div className="gw-plaque" role="note">
                <span className="gw-plaque-icon" aria-hidden>
                  💧
                </span>
                <span className="gw-plaque-value mono">
                  {d.grace.trend({ cm: bundle.grace.result.trendCmPerYear })}
                </span>
                <span className="gw-plaque-text">{d.grace.blurbFalling}</span>
              </div>
            )}

          {result.plans.length === 0 ? (
            <div className="card state">
              <h2>{d.rotation.noPlans}</h2>
              <p>{d.rotation.noPlansSub}</p>
            </div>
          ) : (
            (() => {
              const plans = result.plans;
              const featured =
                plans.find((p) => p.id === featuredId) ??
                plans.find((p) => p.id === "best-fit") ??
                plans[0];
              const featuredLabel =
                featured.id === "best-fit"
                  ? d.plan.kisht
                  : d.planTitle[featured.id as keyof typeof d.planTitle] ?? featured.title;
              return (
                <>
                  <div className="rotation-feature">
                    {currentPlan && (
                      <div className="feature-col is-now">
                        <span className="feature-label">{d.rotation.nowTitle}</span>
                        <PlanCard plan={currentPlan} />
                      </div>
                    )}
                    <div className="feature-col">
                      <span className="feature-label is-kisht">{featuredLabel}</span>
                      <PlanCard
                        plan={featured}
                        onSeeEvidence={() => {
                          setWhyPlanId(featured.id);
                          setWhyOpen(true);
                        }}
                      />
                    </div>
                  </div>

                  {plans.length > 1 && (
                    <div className="plan-switch" role="group" aria-label={d.rotation.title}>
                      {plans.map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          className={"plan-switch-btn" + (plan.id === featured.id ? " active" : "")}
                          aria-pressed={plan.id === featured.id}
                          onClick={() => setFeaturedId(plan.id)}
                        >
                          <span className="plan-switch-title">
                            {plan.id === "best-fit"
                              ? d.plan.kisht
                              : d.planTitle[plan.id as keyof typeof d.planTitle] ?? plan.title}
                          </span>
                          <span className="plan-switch-match mono">
                            {d.rotation.match({ pct: plan.matchPct })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {plans.length < 3 && <p className="plans-note">{d.rotation.fewerPlansNote}</p>}
                </>
              );
            })()
          )}

          {result.excluded.length > 0 && (
            <div className="card panel-block excluded-card">
              <h2 className="block-h">
                {d.rotation.excludedHeading({ n: result.excluded.length })}
              </h2>
              <div className="excluded-chips">
                {result.excluded.map((e) => (
                  <span key={e.crop.id} className="excluded-chip" title={e.reason}>
                    {cropName(d, e.crop.id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.plans.length > 0 && (
            <details
              className="card panel-block why-collapse"
              open={whyOpen}
              onToggle={(e) => setWhyOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="why-collapse-summary">
                <span className="block-h">{d.plan.whyThisPlan}</span>
                <span className="slider-desc">{d.plan.whyThisPlanHint}</span>
              </summary>
              <WhyPanel result={result} />
            </details>
          )}
        </>
      )}

      <NasaDataBlock />
    </section>
  );
}
