import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CROPS } from "../data/crops";
import { matchExample } from "../lib/demoCache";
import type { CurrentRotation, Priorities, Scenario } from "../lib/rotation/types";

const ALL_CROP_IDS = CROPS.map((c) => c.id);

const DEFAULT_PRIORITIES: Priorities = { water: 5, soil: 5, income: 5, reliability: 5 };
const DEFAULT_SCENARIO: Scenario = { rainDeltaPct: 0, tempDeltaC: 0 };

const CURRENT_PRESETS: Record<string, CurrentRotation> = {
  vakhsh: { summer: "cotton", winter: "wheat" },
  sughd: { summer: "cotton", winter: "wheat" },
  hissar: { summer: "cotton", winter: "wheat" },
};

export function defaultCurrentRotation(
  lat: number | null,
  lon: number | null,
): CurrentRotation {
  if (lat != null && lon != null) {
    const id = matchExample(lat, lon);
    if (id && CURRENT_PRESETS[id]) return CURRENT_PRESETS[id];
  }
  return { summer: "maize", winter: "wheat" };
}

interface PlanState {
  priorities: Priorities;
  setPriority: (key: keyof Priorities, value: number) => void;

  selectable: Set<string>;
  toggleCrop: (id: string) => void;
  setAllCrops: (on: boolean) => void;

  scenario: Scenario;
  setScenario: (s: Scenario) => void;

  currentRotation: CurrentRotation | null;
  setCurrentRotation: (r: CurrentRotation) => void;

  whyPlanId: string | null;
  setWhyPlanId: (id: string | null) => void;
}

const PlanContext = createContext<PlanState | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES);
  const [selectable, setSelectable] = useState<Set<string>>(() => new Set(ALL_CROP_IDS));
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [currentRotation, setCurrentRotation] = useState<CurrentRotation | null>(null);
  const [whyPlanId, setWhyPlanId] = useState<string | null>(null);

  const setPriority = useCallback((key: keyof Priorities, value: number) => {
    setPriorities((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleCrop = useCallback((id: string) => {
    setSelectable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllCrops = useCallback((on: boolean) => {
    setSelectable(on ? new Set(ALL_CROP_IDS) : new Set());
  }, []);

  const value = useMemo<PlanState>(
    () => ({
      priorities,
      setPriority,
      selectable,
      toggleCrop,
      setAllCrops,
      scenario,
      setScenario,
      currentRotation,
      setCurrentRotation,
      whyPlanId,
      setWhyPlanId,
    }),
    [
      priorities,
      setPriority,
      selectable,
      toggleCrop,
      setAllCrops,
      scenario,
      currentRotation,
      whyPlanId,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
