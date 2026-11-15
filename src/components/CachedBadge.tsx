import { useI18n } from "../i18n";

/**
 * Small pill shown when the data on screen came from the offline demo cache
 * (public/data/demo) rather than a live API call — so a judge watching the
 * demo on flaky venue Wi-Fi knows the numbers are real NASA values, just
 * pre-fetched. See src/lib/demoCache.ts.
 */
export default function CachedBadge() {
  const { d } = useI18n();
  return (
    <span className="cached-badge" title={d.common.cachedData}>
      {d.common.cachedData}
    </span>
  );
}
