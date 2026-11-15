import { useI18n } from "../i18n";

export type DataState = "idle" | "loading" | "ready" | "unavailable";

export interface DataRow {
  name: string;
  label: string;
  state: DataState;
  cached: boolean;
  detail?: string;
}

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
      {hasField ? (
        <p className="nasa-status-note">{d.fieldSize.coarseNote}</p>
      ) : (
        <p className="nasa-status-hint">{d.field.pickToStart}</p>
      )}
    </div>
  );
}
