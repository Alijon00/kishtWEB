import { useI18n } from "../i18n";

export type DataState = "idle" | "loading" | "ready" | "unavailable";

export interface DataRow {
  /** Dataset proper name, e.g. "NASA POWER" (not translated). */
  name: string;
  /** Plain-language label, e.g. "Climate since 1995". */
  label: string;
  state: DataState;
  cached: boolean;
  /** Short inline result shown when ready (e.g. "247 m · flat"). */
  detail?: string;
}

/**
 * Compact "NASA data for this field" status list on screen 1. Each row shows a
 * dataset, a plain label, and a live status (loading / ready / cached /
 * unavailable). The hooks that feed it are mounted on screen 1, so the fetches
 * are already in flight (prefetched) by the time the user opens screen 2.
 */
export default function NasaDataStatus({
  rows,
  hasField,
}: {
  rows: DataRow[];
  hasField: boolean;
}) {
  const { d } = useI18n();
  return (
    <div className={"card panel-block nasa-status" + (hasField ? "" : " is-idle")}>
      <div className="panel-label">{d.field.nasaData}</div>
      <ul className="nasa-status-list">
        {rows.map((r) => (
          <li key={r.name} className="nasa-status-row">
            <span className="nasa-ds">
              <span className="nasa-ds-name">{r.name}</span>
              <span className="nasa-ds-label">{r.label}</span>
            </span>
            <span className="nasa-state">
              {!hasField ? (
                <span className="nasa-dim" aria-hidden>
                  —
                </span>
              ) : r.state === "loading" || r.state === "idle" ? (
                <span className="nasa-loading">
                  <span className="mini-spinner" aria-hidden />
                  {d.field.statusLoading}
                </span>
              ) : r.state === "ready" ? (
                <span className="nasa-ready">
                  {r.detail && <span className="nasa-detail mono">{r.detail}</span>}
                  {r.cached ? (
                    <span className="cached-badge">{d.common.cachedData}</span>
                  ) : (
                    <span className="nasa-ok" aria-label="ready">
                      ✓
                    </span>
                  )}
                </span>
              ) : (
                <span className="nasa-unavail">{d.field.statusUnavailable}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!hasField && <p className="nasa-status-hint">{d.field.pickToStart}</p>}
    </div>
  );
}
