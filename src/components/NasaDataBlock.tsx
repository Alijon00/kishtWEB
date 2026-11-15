import { useI18n } from "../i18n";

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
