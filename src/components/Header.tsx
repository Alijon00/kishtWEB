import { useI18n } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export interface Step {
  id: number;
  labelKey: "field" | "changed" | "plan";
}

export const STEPS: Step[] = [
  { id: 1, labelKey: "field" },
  { id: 2, labelKey: "changed" },
  { id: 3, labelKey: "plan" },
];

interface HeaderProps {
  activeStep: number;
  onStep: (step: number) => void;
  /** Steps 2–3 need a field; step 1 is always available. */
  hasField: boolean;
}

/** Small leaf mark for the wordmark. */
function Leaf() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="brand-leaf">
      <path
        d="M20 3c-9 0-15 5-15 12 0 2 .5 3.6 1.3 5C7 16 11 12 18 10c-5 3-8 7-9.4 11.6.9.3 1.9.4 3 .4 7 0 11-6 11-13 0-2.4-.6-4.6-2.6-6Z"
        fill="var(--primary)"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header({ activeStep, onStep, hasField }: HeaderProps) {
  const { d } = useI18n();

  return (
    <header className="header">
      <div className="brand">
        <Leaf />
        <span className="brand-name">
          kisht<span className="brand-dot">.</span>
        </span>
      </div>

      <nav aria-label={d.header.steps} className="steps-nav">
        <ol className="steps">
          {STEPS.map((step, i) => {
            const isActive = step.id === activeStep;
            const isDone = step.id < activeStep;
            const isLive = step.id === 1 || hasField;
            return (
              <li key={step.id} className="step-item">
                <button
                  type="button"
                  className={
                    "step" +
                    (isActive ? " active" : "") +
                    (isDone ? " done" : "") +
                    (isLive ? "" : " disabled")
                  }
                  aria-current={isActive ? "step" : undefined}
                  disabled={!isLive}
                  onClick={() => isLive && onStep(step.id)}
                >
                  <span className="step-dot" aria-hidden>
                    {isDone ? <Check /> : step.id}
                  </span>
                  <span className="step-text">{d.nav[step.labelKey]}</span>
                </button>
                {i < STEPS.length - 1 && <span className="step-sep" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="header-right">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
