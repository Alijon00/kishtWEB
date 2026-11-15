import { useState } from "react";
import FieldMap from "../components/FieldMap";
import GlobeMap from "../components/GlobeMap";
import { hasWebGL } from "../lib/webgl";
import FieldCard from "../components/FieldCard";
import NasaDataStatus, { type DataRow, type DataState } from "../components/NasaDataStatus";
import { EXAMPLE_SITES, useField } from "../state/field";
import { useSoil } from "../state/useSoil";
import { useClimate } from "../state/useClimate";
import { useGroundwater } from "../state/useGroundwater";
import { useTerrain } from "../state/useTerrain";
import { SLOPE_FLAT_PCT } from "../lib/terrain";
import { EROSION_SLOPE_PCT } from "../lib/rotation/constants";
import { climatePeriods, dropPartialYears, expectedPeriods } from "../lib/climate";
import { searchPlace, type PlaceResult } from "../lib/geocode";
import { useI18n } from "../i18n";
import type { Dict } from "../i18n/en";

interface FieldProps {
  onContinue: () => void;
}

export default function Field({ onContinue }: FieldProps) {
  const { d } = useI18n();
  const { field, selectPoint } = useField();
  const lat = field?.lat ?? null;
  const lon = field?.lon ?? null;
  const soil = useSoil(lat, lon);
  const climate = useClimate(lat, lon);
  const grace = useGroundwater(lat, lon);
  const terrain = useTerrain(lat, lon);

  const [MapComponent] = useState(() => (hasWebGL() ? GlobeMap : FieldMap));

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchMsg, setSearchMsg] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  const runSearch = () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchMsg("");
    setResults([]);
    searchPlace(q)
      .then((r) => {
        setResults(r);
        if (r.length === 0) setSearchMsg(d.field.noResults);
      })
      .catch(() => setSearchMsg(d.field.searchError))
      .finally(() => setSearching(false));
  };

  const useMyLocation = () => {
    setGeoMsg("");
    if (!("geolocation" in navigator)) {
      setGeoMsg(d.field.noGeoSupport);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => selectPoint(pos.coords.latitude, pos.coords.longitude),
      () => setGeoMsg(d.field.geoError),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const pickResult = (r: PlaceResult) => {
    selectPoint(r.lat, r.lon, r.displayName.split(",").slice(0, 2).join(",").trim());
    setResults([]);
    setQuery("");
    setSearchFocused(false);
  };

  const pickExample = (lat: number, lon: number, name: string) => {
    selectPoint(lat, lon, name);
    setSearchFocused(false);
  };

  const showExamples = searchFocused && !query.trim() && results.length === 0;

  const slopeLabel = (s: number) =>
    s <= SLOPE_FLAT_PCT ? d.terrain.flat : s <= EROSION_SLOPE_PCT ? d.terrain.gentle : d.terrain.steep;
  const climateState: DataState =
    climate.status === "error" ? "unavailable" : (climate.status as DataState);
  const climateStartYear = (
    climate.records ? climatePeriods(dropPartialYears(climate.records)) : expectedPeriods()
  ).baseline[0];
  const dataRows: DataRow[] = [
    { name: "NASA POWER", label: d.field.dsClimate({ year: climateStartYear }), state: climateState, cached: climate.cached },
    { name: "GRACE-FO", label: d.field.dsWater, state: grace.status as DataState, cached: grace.cached },
    {
      name: "SRTM",
      label: d.field.dsTerrain,
      state: terrain.status as DataState,
      cached: terrain.cached,
      detail:
        terrain.status === "ready" && terrain.result
          ? `${Math.round(terrain.result.elevationM).toLocaleString("en-US")} m · ${slopeLabel(terrain.result.slopePct)}`
          : undefined,
    },
    {
      name: "SoilGrids",
      label: d.field.dsSoil,
      state: soil.status === "error" ? "unavailable" : (soil.status as DataState),
      cached: soil.cached,
    },
  ];

  return (
    <section className="field-screen">
      <div className="screen-head">
        <h1>{d.field.title}</h1>
        <div className="subtitle">{d.field.subtitle}</div>
      </div>

      <div className="field-layout">
        <div className="field-map-col">
          <MapComponent
            lat={field?.lat ?? null}
            lon={field?.lon ?? null}
            onPick={(lat, lon) => selectPoint(lat, lon)}
            searchSlot={
              <div className="map-search">
                <div className="search-row">
                  <input
                    id="place-search"
                    type="text"
                    aria-label={d.field.searchLabel}
                    placeholder={d.field.searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                  />
                  <button className="btn btn-ghost" onClick={runSearch} disabled={searching}>
                    {searching ? d.field.searching : d.field.searchBtn}
                  </button>
                </div>
                {searchMsg && <p className="panel-msg map-overlay-msg">{searchMsg}</p>}
                {results.length > 0 && (
                  <ul className="search-results">
                    {results.map((r, i) => (
                      <li key={i}>
                        <button className="result-btn" onMouseDown={() => pickResult(r)}>
                          {r.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showExamples && (
                  <ul className="search-results examples-dd">
                    <li className="examples-dd-label">{d.field.tryExample}</li>
                    {EXAMPLE_SITES.map((s) => {
                      const name = d.examples[s.id as keyof Dict["examples"]] ?? s.name;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="result-btn"
                            onMouseDown={() => pickExample(s.lat, s.lon, name)}
                          >
                            {name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            }
          >
            {}
            {field && (
              <span className="map-coords coord">
                {field.lat.toFixed(4)}, {field.lon.toFixed(4)}
              </span>
            )}
            <button className="btn btn-ghost btn-icon" onClick={useMyLocation}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {d.field.useLocation}
            </button>
          </MapComponent>
          {geoMsg && <p className="panel-msg">{geoMsg}</p>}
        </div>

        <div className="field-panel-col">
          {field ? (
            <FieldCard field={field} soil={soil} />
          ) : (
            <div className="card panel-block field-hint">
              <div className="panel-label">{d.field.yourField}</div>
              <p className="panel-hint">{d.field.noFieldYet}</p>
            </div>
          )}

          <NasaDataStatus rows={dataRows} hasField={!!field} />

          <button
            className="btn btn-block btn-continue field-continue"
            onClick={onContinue}
            disabled={!field}
          >
            {d.field.continue}
          </button>
        </div>
      </div>
    </section>
  );
}
