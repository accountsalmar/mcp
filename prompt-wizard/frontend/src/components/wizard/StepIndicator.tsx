interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  labels?: string[];
}

const DEFAULT_LABELS = ['Define', 'Review', 'Evaluate', 'Refine'];

export function StepIndicator({
  currentStep,
  totalSteps = 4,
  labels = DEFAULT_LABELS
}: StepIndicatorProps) {
  return (
    <>
      <div className="progress-bar">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`progress-step ${currentStep >= i + 1 ? 'active' : ''}`}
          />
        ))}
      </div>
      <div className="progress-labels">
        {labels.map((label, i) => (
          <span key={i} className={currentStep === i + 1 ? 'active' : ''}>
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
