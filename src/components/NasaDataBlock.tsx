import { useI18n } from "../i18n";

/**
 * "NASA data used" footer block — a plain-language summary of which datasets
 * feed the plan and what each one contributes, plus an honest note on the
 * US-only datasets we deliberately don't use. Shown at the foot of the plan
 * screen and mirrored in the README.
 */
export default function NasaDataBlock() {
  const { d } = useI18n();
  return (
    <div className="card panel-block nasa-data-block">
      <h2 className="block-h">{d.dataUsed.heading}</h2>
      <p className="slider-desc">{d.dataUsed.intro}</p>
      <ul className="nasa-data-list">
        <li>{d.dataUsed.power}</li>
        <li>{d.dataUsed.grace}</li>
        <li>{d.dataUsed.srtm}</li>
        <li>{d.dataUsed.soilgrids}</li>
      </ul>
      <p className="nasa-data-us">{d.dataUsed.usNote}</p>
    </div>
  );
}
