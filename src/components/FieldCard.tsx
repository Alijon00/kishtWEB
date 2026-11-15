import type { PhRating, SocRating } from "../lib/soil";
import type { UseSoilResult } from "../state/useSoil";
import { fieldLabel, type Field } from "../state/field";
import CachedBadge from "./CachedBadge";
import { useI18n } from "../i18n";

/**
 * Tone for the soil chips. Organic carbon: good = green, low = red (a real
 * fertility problem), medium = neutral. pH: neutral = green; acidic/alkaline =
 * amber "caution" (off-ideal but workable), not the red used for a failure.
 */
const socTone = (r: SocRating) => (r === "good" ? "down" : r === "low" ? "up" : "neutral");
const phTone = (r: PhRating) => (r === "neutral" ? "down" : "warn");

/**
 * "Your field" — the merged selected-point + soil card on screen 1: place name,
 * small coordinates, then the three SoilGrids rows (texture, organic carbon, pH).
 */
export default function FieldCard({ field, soil }: { field: Field; soil: UseSoilResult }) {
  const { d } = useI18n();
  const a = soil.assessment;

  return (
    <div className="card field-card">
      <div className="panel-label">{d.field.yourField}</div>
      <div className="field-name">{fieldLabel(field)}</div>
      <div className="coords coord">
        {field.lat.toFixed(4)}, {field.lon.toFixed(4)}
      </div>

      {soil.status === "loading" && (
        <div className="soil-state">
          <div className="spinner" />
          <p>{d.soil.reading}</p>
        </div>
      )}

      {soil.status === "unavailable" && (
        <div className="soil-state">
          <p>{d.soil.unavailable}</p>
        </div>
      )}

      {soil.status === "error" && (
        <div className="soil-state">
          <p>{d.soil.error}</p>
          <button className="btn btn-small" onClick={soil.reload}>
            {d.common.tryAgain}
          </button>
        </div>
      )}

      {soil.status === "ready" && a && (
        <>
          {soil.builtUp &&
            (() => {
              const note = `${d.soil.builtUp} ${d.soil.nearestNote({ km: soil.nearestKm })}`;
              return (
                <p className="soil-builtup" title={note}>
                  {note}
                </p>
              );
            })()}
          <dl className="soil-grid">
            <div className="soil-item">
              <dt>{d.soil.texture}</dt>
              <dd>{a.texture}</dd>
            </div>
            <div className="soil-item">
              <dt>{d.soil.organicCarbon}</dt>
              <dd>
                {a.socPct.toFixed(1)}%{" "}
                <span className={`tag ${socTone(a.socRating)}`}>{d.socLevel[a.socRating]}</span>
              </dd>
            </div>
            <div className="soil-item">
              <dt>{d.soil.ph}</dt>
              <dd>
                {a.ph.toFixed(1)}{" "}
                <span className={`tag ${phTone(a.phRating)}`}>{d.soil.phRating[a.phRating]}</span>
              </dd>
            </div>
          </dl>
          <div className="source">
            {d.common.source} · {d.soil.source}
            {soil.cached && <CachedBadge />}
          </div>
        </>
      )}
    </div>
  );
}
