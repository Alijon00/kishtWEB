import { useMemo } from "react";
import TempChart, { type TempPoint } from "../components/TempChart";
import RainChart, { type RainPoint } from "../components/RainChart";
import ConditionCard from "../components/ConditionCard";
import CachedBadge from "../components/CachedBadge";
import { useGroundwater } from "../state/useGroundwater";
import { useTerrain } from "../state/useTerrain";
import type { MonthlyRecord } from "../lib/types";
import type { GraceCategory } from "../lib/grace";
import {
  climatePeriods,
  dropPartialYears,
  expectedPeriods,
  fmtRange,
  monthlyPrecipProfile,
  soilMoistureSummary,
  summarize,
  summerTrend,
  yearlySummerTemps,
} from "../lib/climate";
import { buildInsight } from "../lib/insight";
import { fieldLabel, useField } from "../state/field";
import { fmtArea } from "../lib/fieldSize";
import { useClimate } from "../state/useClimate";
import { useSoil } from "../state/useSoil";
import { renderInsight, useI18n } from "../i18n";

const signed = (n: number, digits: number) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

interface ClimateProps {
  onPickField: () => void;
  onContinue: () => void;
}

export default function Climate({ onPickField, onContinue }: ClimateProps) {
  const { d } = useI18n();
  const { field, size, sizeM2 } = useField();
  const sizeChip = `${fmtArea(size.value)} ${d.fieldSize.units[size.unit]}`;
  const climate = useClimate(field?.lat ?? null, field?.lon ?? null);
  const soil = useSoil(field?.lat ?? null, field?.lon ?? null, sizeM2);
  const grace = useGroundwater(field?.lat ?? null, field?.lon ?? null);
  const terrain = useTerrain(field?.lat ?? null, field?.lon ?? null, sizeM2);

  const status = climate.status === "idle" ? "loading" : climate.status;
  const records = climate.records;
  const anyCached = climate.cached || soil.cached || grace.cached || terrain.cached;

  const periods = records ? climatePeriods(dropPartialYears(records)) : expectedPeriods();
  const subtitle = d.climate.subtitle({
    baseline: fmtRange(periods.baseline),
    recent: fmtRange(periods.recent),
  });

  if (!field) {
    return (
      <section>
        <div className="screen-head">
          <h1>{d.climate.title}</h1>
          <div className="subtitle">{subtitle}</div>
        </div>
        <div className="card state">
          <h2>{d.climate.pickTitle}</h2>
          <p>{d.climate.pickHint}</p>
          <button className="btn" onClick={onPickField}>
            {d.common.pickFieldBtn}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="screen-head">
        <h1>{d.climate.title}</h1>
        <div className="subtitle">
          {subtitle} · {fieldLabel(field)} · {sizeChip}
          {anyCached && <CachedBadge />}
        </div>
      </div>

      {status === "loading" && (
        <div className="card state">
          <div className="spinner" />
          <h2>{d.common.loading}</h2>
          <p>{d.climate.loadingSub}</p>
        </div>
      )}

      {status === "error" && (
        <div className="card state">
          <h2>{d.common.error}</h2>
          <p>{d.common.errorSub}</p>
          {climate.error && <div className="source">{climate.error}</div>}
          <button className="btn" onClick={climate.reload}>
            {d.common.tryAgain}
          </button>
        </div>
      )}

      {status === "ready" && records && (
        <>
          <Report records={records} soil={soil} grace={grace} terrain={terrain} />
          <button className="btn btn-block btn-continue climate-continue" onClick={onContinue}>
            {d.climate.continue}
          </button>
        </>
      )}
    </section>
  );
}

interface ReportProps {
  records: MonthlyRecord[];
  soil: ReturnType<typeof useSoil>;
  grace: ReturnType<typeof useGroundwater>;
  terrain: ReturnType<typeof useTerrain>;
}

const GRACE_LABEL = (d: ReturnType<typeof useI18n>["d"], c: GraceCategory): string =>
  (c === "falling" ? d.grace.labelFalling : c === "rising" ? d.grace.labelRising : d.grace.labelStable).toLowerCase();

function Report({ records, soil, grace, terrain }: ReportProps) {
  const { d } = useI18n();
  const recs = useMemo(() => dropPartialYears(records), [records]);
  const summary = useMemo(() => summarize(recs), [recs]);
  const moisture = useMemo(() => soilMoistureSummary(recs), [recs]);
  const insight = useMemo(() => buildInsight(summary, soil.assessment), [summary, soil.assessment]);

  const baselineLabel = fmtRange(summary.baselineYears);
  const recentLabel = fmtRange(summary.recentYears);
  const trendLabel = fmtRange(summary.trendYears);

  const tempData: TempPoint[] = useMemo(() => {
    const fit = summerTrend(recs, summary.trendYears);
    return yearlySummerTemps(recs, summary.trendYears).map((p) => ({
      year: p.year,
      temp: Number(p.temp.toFixed(2)),
      trend: Number((fit.slopePerYear * p.year + fit.intercept).toFixed(2)),
    }));
  }, [recs, summary.trendYears]);

  const rainData: RainPoint[] = useMemo(() => {
    const base = monthlyPrecipProfile(recs, summary.baselineYears);
    const recent = monthlyPrecipProfile(recs, summary.recentYears);
    return base.map((b, i) => ({
      month: d.charts.months[i],
      baseline: Number(b.precipMm.toFixed(1)),
      recent: Number(recent[i].precipMm.toFixed(1)),
    }));
  }, [recs, d, summary.baselineYears, summary.recentYears]);

  const climateTone =
    summary.summerTempChangeC >= 0.5 || summary.annualPrecipChangePct <= -5 ? "warn" : "neutral";
  const climateLead = d.conditions.climateLead({
    tempDelta: `${signed(summary.summerTempChangeC, 1)} °C`,
    rainPct: `${signed(summary.annualPrecipChangePct, 0)}%`,
    baseline: baselineLabel,
  });

  const graceWord = grace.status === "ready" && grace.result ? GRACE_LABEL(d, grace.result.category) : null;
  const moistureWord = moisture.hasData ? d.soilMoistureTrend[moisture.trend].toLowerCase() : null;
  const waterLead =
    graceWord && moistureWord
      ? d.conditions.waterLead({ grace: graceWord, moisture: moistureWord })
      : graceWord && grace.result
        ? grace.result.category === "falling"
          ? d.grace.blurbFalling
          : grace.result.category === "rising"
            ? d.grace.blurbRising
            : d.grace.blurbStable
        : moistureWord
          ? d.conditions.waterLeadNoGrace({ moisture: moistureWord })
          : d.conditions.waterUnknown;
  const waterTone =
    grace.result?.category === "falling" || moisture.trend === "falling"
      ? "warn"
      : grace.result?.category === "rising" || (moisture.hasData && moisture.trend === "rising")
        ? "good"
        : "neutral";
  const waterStat =
    grace.status === "ready" && grace.result
      ? d.grace.trend({ cm: grace.result.trendCmPerYear })
      : undefined;

  const a = soil.assessment;
  const soilBase = a
    ? d.conditions.soilLead({
        texture: a.texture,
        soc: d.socLevel[a.socRating],
        ph: a.ph.toFixed(1),
        phr: d.soil.phRating[a.phRating],
      })
    : d.conditions.soilUnknown;
  const soilLead =
    a && soil.builtUp ? `${d.soil.nearestNote({ km: soil.nearestKm })}. ${soilBase}` : soilBase;
  const soilTone = a ? (a.socRating === "low" || a.phRating !== "neutral" ? "warn" : "good") : "neutral";
  const soilStat = a ? `${a.socPct.toFixed(1)}% C` : undefined;

  const t = terrain.status === "ready" ? terrain.result : null;
  const steep = !!t && t.slopePct > 8;
  const landLead = t
    ? (steep ? d.conditions.landSteep : d.conditions.landGentle)({
        elevationM: Math.round(t.elevationM).toLocaleString("en-US"),
        slopePct: `${t.slopePct}%`,
      })
    : d.conditions.landUnknown;
  const landStat = t ? `${Math.round(t.elevationM).toLocaleString("en-US")} m · ${t.slopePct}%` : undefined;

  return (
    <>
      {}
      <div className="inshort">
        <span className="inshort-tag">{d.conditions.inShort}</span>
        <div className="inshort-body">
          {insight.map((item, i) => (
            <p key={i}>{renderInsight(d, item, baselineLabel)}</p>
          ))}
        </div>
      </div>

      {}
      <div className="condition-grid">
        <ConditionCard
          title={d.conditions.climate}
          lead={climateLead}
          stat={`${signed(summary.summerTempChangeC, 1)}°C · ${signed(summary.annualPrecipChangePct, 0)}%`}
          tone={climateTone}
          source={d.sources.power.name}
          cached={false}
        />
        <ConditionCard
          title={d.conditions.water}
          lead={waterLead}
          stat={waterStat}
          tone={waterTone}
          source="GRACE-FO · NASA POWER"
          cached={grace.cached}
        />
        <ConditionCard
          title={d.conditions.soil}
          lead={soilLead}
          stat={soilStat}
          tone={soilTone}
          source={d.soil.source}
          cached={soil.cached}
        />
        <ConditionCard
          title={d.conditions.land}
          lead={landLead}
          stat={landStat}
          tone={steep ? "warn" : "neutral"}
          source={d.terrain.source}
          cached={terrain.cached}
        />
      </div>

      {}
      <details className="card panel-block measurements">
        <summary className="why-collapse-summary">
          <span className="block-h">{d.climate.seeMeasurements}</span>
        </summary>
        <div className="measurements-body">
          <TempChart data={tempData} rangeLabel={trendLabel} />
          <RainChart data={rainData} baselineLabel={baselineLabel} recentLabel={recentLabel} />
        </div>
      </details>
    </>
  );
}
