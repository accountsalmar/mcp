import { useState } from 'react';
import { StepIndicator } from './StepIndicator';
import { DefineStep } from './DefineStep';
import { ReviewStep } from './ReviewStep';
import { EvaluateStep } from './EvaluateStep';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { evaluationApi } from '../../api/evaluation';

export function WizardContainer() {
  const {
    currentStep,
    goToStep,
    product,
    process,
    performance,
    answers,
    setEvaluation,
    setFinalPrompt,
    setPreviousScore,
    reset,
  } = useWizard();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDefineComplete = () => {
    goToStep(2);
  };

  const handleBack = () => {
    goToStep(currentStep - 1);
  };

  const handleStartOver = () => {
    reset();
    goToStep(1);
  };

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      // Step 1: Generate prompt
      const generationResult = await evaluationApi.generate({
        product,
        process: process || undefined,
        performance: performance || undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
      });
      setFinalPrompt(generationResult.prompt);

      // Step 2: Evaluate prompt
      const evaluationResult = await evaluationApi.evaluate({
        product,
        process: process || undefined,
        performance: performance || undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        isReevaluation: false,
      });
      setEvaluation(evaluationResult);
      setPreviousScore(evaluationResult.totalScore);

      // Move to evaluate step
      goToStep(3);
    } catch (error) {
      console.error('Evaluation failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to evaluate prompt');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (loading) {
      return (
        <LoadingSpinner
          text="Generating your prompt..."
          subtext="Evaluating against 4D Framework (30-point rubric)"
        />
      );
    }

    switch (currentStep) {
      case 1:
        return <DefineStep onContinue={handleDefineComplete} />;
      case 2:
        return (
          <ReviewStep
            onBack={handleBack}
            onContinue={handleEvaluate}
            loading={loading}
          />
        );
      case 3:
      case 4:
        // EvaluateStep handles both evaluation display and refinement
        return <EvaluateStep onStartOver={handleStartOver} />;
      default:
        return null;
    }
  };

  return (
    <>
      <StepIndicator currentStep={currentStep} />
      <div style={{ marginTop: '30px' }}>
        {renderStep()}
      </div>
    </>
  );
}
