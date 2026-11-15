import { useEffect, useState } from "react";
import Header from "./components/Header";
import Field from "./pages/Field";
import Climate from "./pages/Climate";
import Plan from "./pages/Plan";
import { FieldProvider, useField } from "./state/field";
import { PlanProvider } from "./state/plan";
import { LanguageProvider, useI18n } from "./i18n";

function Shell() {
  const { field } = useField();
  const { d } = useI18n();
  const [step, setStep] = useState(1);

  // Tab title follows the current step + language, e.g. "Your field · kisht.".
  useEffect(() => {
    const label = step === 1 ? d.tab.field : step === 2 ? d.tab.changed : d.tab.plan;
    document.title = `${label} · kisht.`;
  }, [step, d]);

  return (
    <div className={"app" + (step === 1 ? " app--fixed" : "")}>
      <Header activeStep={step} onStep={setStep} hasField={!!field} />
      <main>
        {step === 1 && <Field onContinue={() => setStep(2)} />}
        {step === 2 && (
          <Climate onPickField={() => setStep(1)} onContinue={() => setStep(3)} />
        )}
        {step === 3 && <Plan onPickField={() => setStep(1)} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <FieldProvider>
        <PlanProvider>
          <Shell />
        </PlanProvider>
      </FieldProvider>
    </LanguageProvider>
  );
}
