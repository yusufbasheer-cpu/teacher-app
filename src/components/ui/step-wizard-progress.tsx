type WizardStep = {
  id: number;
  label: string;
};

type Props = {
  steps: readonly WizardStep[];
  currentStep: number;
};

/** Horizontal numbered stepper shared by the lesson plan, question paper, and
 * differentiated worksheet wizards — active step filled teal, completed steps
 * show a checkmark. */
export function StepWizardProgress({ steps, currentStep }: Props) {
  return (
    <div className="relative mx-auto max-w-[560px] px-2">
      <div
        className="absolute left-2 right-2 top-4 h-0.5"
        style={{ background: "#E3D9C8" }}
        aria-hidden="true"
      />
      <ol className="relative flex justify-between">
        {steps.map(({ id, label }) => {
          const isActive = currentStep === id;
          const isDone = currentStep > id;
          return (
            <li key={id} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition"
                style={{
                  borderColor: isActive || isDone ? "#0E9484" : "#E3D9C8",
                  background: isActive ? "#0E9484" : isDone ? "#0B6B5F" : "#fff",
                  color: isActive || isDone ? "#fff" : "#A79A87",
                }}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓" : id}
              </span>
              <span
                className="text-center text-xs font-semibold"
                style={{ color: isActive ? "#241A12" : isDone ? "#0B6B5F" : "#A79A87" }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
