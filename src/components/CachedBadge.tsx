import { useI18n } from "../i18n";

export default function CachedBadge() {
  const { d } = useI18n();
  return (
    <span className="cached-badge" title={d.common.cachedData}>
      {d.common.cachedData}
    </span>
  );
}
