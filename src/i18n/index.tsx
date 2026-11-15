import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en, { type Dict } from "./en";
import ru from "./ru";
import tg from "./tg";
import type { Reason } from "../lib/rotation/types";
import type { InsightItem } from "../lib/insight";

export type Lang = "en" | "ru" | "tg";
export const LANGS: Lang[] = ["en", "ru", "tg"];

const DICTS: Record<Lang, Dict> = { en, ru, tg };
const STORAGE_KEY = "kisht.lang";

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "ru" || v === "tg" || v === "en" ? v : "en";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  d: Dict;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
    }
  }, []);
  const value = useMemo<I18nValue>(() => ({ lang, setLang, d: DICTS[lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within a LanguageProvider");
  return ctx;
}

export function cropName(d: Dict, id: string): string {
  return (d.crops as Record<string, string>)[id] ?? id;
}

export function renderInsight(d: Dict, item: InsightItem, baseline = ""): string {
  const p = item.params ?? {};
  switch (item.code) {
    case "heatHotter":
      return d.insight.heatHotter({ deg: Number(p.deg), baseline });
    case "heatCooler":
      return d.insight.heatCooler({ deg: Number(p.deg) });
    case "heatStable":
      return d.insight.heatStable;
    case "rainDown":
      return d.insight.rainDown({ pct: Number(p.pct) });
    case "rainUp":
      return d.insight.rainUp({ pct: Number(p.pct) });
    case "rainStable":
      return d.insight.rainStable;
    case "hotMore":
      return d.insight.hotMore({ n: Number(p.n) });
    case "hotFewer":
      return d.insight.hotFewer;
    case "soilLowCarbon":
      return d.insight.soilLowCarbon;
    case "soilAlkaline":
      return d.insight.soilAlkaline;
    case "soilAcidic":
      return d.insight.soilAcidic;
  }
}

export interface RenderedReason {
  dataPoint: string;
  source: string;
  rule: string;
  effect: string;
}

export function renderReason(d: Dict, r: Reason): RenderedReason {
  const source = d.reason.sourceName(r.source);
  const p = r.params;
  switch (r.code) {
    case "rain": {
      const ids = (p.thirstyIds as string[] | undefined) ?? [];
      const effect = ids.length
        ? d.reason.rain.effectIrrigate({ crops: ids.map((id) => cropName(d, id)).join(", ") })
        : d.reason.rain.effectKeep;
      return {
        dataPoint: d.reason.rain.dataPoint({
          rainMm: Number(p.rainMm),
          rainChangePct: Number(p.rainChangePct),
          baseline: String(p.baseline ?? ""),
        }),
        source,
        rule: d.reason.rain.rule,
        effect,
      };
    }
    case "heat": {
      const excludedId = p.excludedId as string | undefined;
      const effect = excludedId
        ? d.reason.heat.effectExcluded({
            crop: cropName(d, excludedId),
            limit: Number(p.excludedLimit),
          })
        : d.reason.heat.effectOk;
      return {
        dataPoint: d.reason.heat.dataPoint({ tmaxC: Number(p.tmaxC) }),
        source,
        rule: d.reason.heat.rule,
        effect,
      };
    }
    case "soilLegume":
      return {
        dataPoint: d.reason.soilLegume.dataPoint({ socPct: Number(p.socPct) }),
        source,
        rule: d.reason.soilLegume.rule,
        effect: d.reason.soilLegume.effect({
          crop: cropName(d, String(p.legumeId)),
          year: Number(p.year),
        }),
      };
    case "soilDiversity": {
      const level = String(p.socLevel) as keyof Dict["socLevel"];
      return {
        dataPoint: d.reason.soilDiversity.dataPoint({
          socPct: Number(p.socPct),
          socLevel: d.socLevel[level] ?? String(p.socLevel),
          ph: Number(p.ph),
        }),
        source,
        rule: d.reason.soilDiversity.rule,
        effect: d.reason.soilDiversity.effect({ families: Number(p.families) }),
      };
    }
    case "groundwater": {
      const falling = String(p.category) === "falling";
      return {
        dataPoint: d.reason.groundwater.dataPoint({ cm: Number(p.cm) }),
        source,
        rule: d.reason.groundwater.rule,
        effect: falling
          ? d.reason.groundwater.effectFalling
          : d.reason.groundwater.effectSteady,
      };
    }
    case "erosion": {
      const hasCover = Number(p.hasCover) === 1;
      const elevationM = p.elevationM;
      return {
        dataPoint: d.reason.erosion.dataPoint({
          slopePct: Number(p.slopePct),
          elevationM: elevationM == null ? null : Number(elevationM),
        }),
        source,
        rule: d.reason.erosion.rule,
        effect: hasCover ? d.reason.erosion.effectCover : d.reason.erosion.effectRowCrops,
      };
    }
    case "soilMoisture": {
      const falling = String(p.trend) === "falling";
      const baseline = p.baseline;
      const recent = p.recent;
      return {
        dataPoint:
          baseline == null || recent == null
            ? d.reason.soilMoisture.dataPointTrend({
                trend: d.soilMoistureTrend[String(p.trend) as keyof Dict["soilMoistureTrend"]],
              })
            : d.reason.soilMoisture.dataPoint({
                baseline: Number(baseline),
                recent: Number(recent),
              }),
        source,
        rule: d.reason.soilMoisture.rule,
        effect: falling
          ? d.reason.soilMoisture.effectFalling
          : d.reason.soilMoisture.effectSteady,
      };
    }
    case "scenario": {
      const parts: string[] = [];
      const rainDelta = Number(p.rainDeltaPct);
      const tempDelta = Number(p.tempDeltaC);
      if (rainDelta !== 0) parts.push(d.reason.scenario.rainPart({ pct: Math.abs(rainDelta) }));
      if (tempDelta !== 0) parts.push(d.reason.scenario.tempPart({ deg: tempDelta }));
      return {
        dataPoint: d.reason.scenario.dataPoint({ parts: parts.join(", ") }),
        source,
        rule: d.reason.scenario.rule,
        effect: d.reason.scenario.effect,
      };
    }
    default:
      return { dataPoint: r.dataPoint, source: r.source, rule: r.rule, effect: r.effect };
  }
}
