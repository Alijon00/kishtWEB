import { useEffect, useState } from "react";
import type { PhRating, SocRating } from "../lib/soil";
import type { UseSoilResult } from "../state/useSoil";
import { fieldLabel, useField, type Field } from "../state/field";
import {
  fmtArea,
  MAX_FIELD_M2,
  M2_PER_UNIT,
  toUnit,
  type SizeUnit,
} from "../lib/fieldSize";
import CachedBadge from "./CachedBadge";
import { useI18n } from "../i18n";

const socTone = (r: SocRating) => (r === "good" ? "down" : r === "low" ? "up" : "neutral");
const phTone = (r: PhRating) => (r === "neutral" ? "down" : "warn");

const UNITS: SizeUnit[] = ["sotka", "ha", "km2"];

export default function FieldCard({ field, soil }: { field: Field; soil: UseSoilResult }) {
  const { d } = useI18n();
  const { size, sizeM2, setSize } = useField();
  const a = soil.assessment;

  const [text, setText] = useState(String(size.value));
  useEffect(() => {
    setText(String(size.value));
  }, [size.value]);

  const onValue = (raw: string) => {
    setText(raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) setSize(n, size.unit);
  };

  const targetUnit: SizeUnit =
    size.unit === "ha" ? (sizeM2 >= M2_PER_UNIT.km2 ? "km2" : "sotka") : "ha";
  const converted = `= ${fmtArea(toUnit(sizeM2, targetUnit))} ${d.fieldSize.units[targetUnit]}`;

  return (
    <div className="card field-card">
      <div className="panel-label">{d.field.yourField}</div>
      <div className="field-name">{fieldLabel(field)}</div>
      <div className="coords coord">
        {field.lat.toFixed(4)}, {field.lon.toFixed(4)}
      </div>

      <div className="field-size">
        <label className="field-size-label" htmlFor="field-size-input">
          {d.fieldSize.label}
        </label>
        <input
          id="field-size-input"
          type="number"
          min={0}
          max={MAX_FIELD_M2 / M2_PER_UNIT[size.unit]}
          step="any"
          className="field-size-input"
          value={text}
          onChange={(e) => onValue(e.target.value)}
        />
        <select
          className="field-size-unit"
          aria-label={d.fieldSize.label}
          value={size.unit}
          onChange={(e) => setSize(size.value, e.target.value as SizeUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {d.fieldSize.units[u]}
            </option>
          ))}
        </select>
        <span className="field-size-converted mono">{converted}</span>
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
          <p className="soil-typical" role="note">{d.soil.typical}</p>
        </div>
      )}

      {soil.status === "error" && (
        <div className="soil-state">
          <p>{d.soil.error}</p>
          <p className="soil-typical" role="note">{d.soil.typical}</p>
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
                {soil.sample && (
                  <span className="soil-sub mono">
                    {" "}
                    {d.fieldSize.range({
                      min: soil.sample.socRange[0].toFixed(1),
                      max: soil.sample.socRange[1].toFixed(1),
                    })}
                    %
                  </span>
                )}
              </dd>
            </div>
            <div className="soil-item">
              <dt>{d.soil.ph}</dt>
              <dd>
                {a.ph.toFixed(1)}{" "}
                <span className={`tag ${phTone(a.phRating)}`}>{d.soil.phRating[a.phRating]}</span>
                {soil.sample && (
                  <span className="soil-sub mono">
                    {" "}
                    {d.fieldSize.range({
                      min: soil.sample.phRange[0].toFixed(1),
                      max: soil.sample.phRange[1].toFixed(1),
                    })}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {soil.sample ? (
            <p className="soil-sample-note">{d.fieldSize.soilSampled({ n: soil.sample.points })}</p>
          ) : (
            <p className="soil-sample-note">{d.fieldSize.soilOneCell}</p>
          )}
          <div className="source">
            {d.common.source} · {d.soil.source}
            {soil.cached && <CachedBadge />}
          </div>
        </>
      )}
    </div>
  );
}
