import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ScoreCard } from '../evaluation/ScoreCard';
import { StrengthsList } from '../evaluation/StrengthsList';
import { MissingList } from '../evaluation/MissingList';
import { PromptPreview } from '../evaluation/PromptPreview';
import { ChangeExplanation } from '../evaluation/ChangeExplanation';
import { QuestionCard } from '../questions/QuestionCard';
import { LearningBanner } from '../questions/LearningBanner';
import { useEvaluation } from '../../hooks/useEvaluation';
import { useWizard } from '../../context/WizardContext';

interface EvaluateStepProps {
  onStartOver: () => void;
}

export function EvaluateStep({ onStartOver }: EvaluateStepProps) {
  const { goToStep } = useWizard();
  const {
    evaluation,
    finalPrompt,
    previousScore,
    questionAnswers,
    loading,
    updateQuestionAnswer,
    submitRefinements,
    copyPrompt,
  } = useEvaluation();

  if (!evaluation) {
    return (
      <div className="error-box">
        <p>No evaluation data available. Please go back and try again.</p>
        <div className="btn-group">
          <Button variant="secondary" onClick={() => goToStep(1)}>
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingSpinner
        text="Re-analyzing your improved prompt..."
        subtext="Evaluating improvements against 4D Framework"
      />
    );
  }

  const isComplete = evaluation.totalScore >= 25;

  return (
    <div>
      {/* Prompt Preview */}
      <PromptPreview prompt={finalPrompt} onCopy={copyPrompt} />

      {/* Score Card */}
      <ScoreCard
        totalScore={evaluation.totalScore}
        percentageScore={evaluation.percentageScore}
        productScore={evaluation.productScore}
        processScore={evaluation.processScore}
        performanceScore={evaluation.performanceScore}
        previousScore={previousScore}
      />

      {/* Change Explanation (for re-evaluations) */}
      {evaluation.changeExplanation && (
        <ChangeExplanation explanation={evaluation.changeExplanation} />
      )}

      {/* Strengths */}
      <StrengthsList strengths={evaluation.strengths} />

      {/* Critical Missing */}
      <MissingList items={evaluation.criticalMissing} />

      {/* Questions or Success */}
      {!isComplete && evaluation.questions.length > 0 ? (
        <div>
          <h3 style={{ fontSize: '21px', fontWeight: 600, marginTop: '32px', marginBottom: '12px', color: '#191919' }}>
            Answer These Questions to Improve
          </h3>

          <LearningBanner />

          {evaluation.questions.map((question, i) => (
            <QuestionCard
              key={i}
              question={question}
              index={i}
              selectedAnswers={questionAnswers[i]?.selectedAnswers || []}
              customAnswer={questionAnswers[i]?.customAnswer || ''}
              onAnswerChange={(answers, custom) => updateQuestionAnswer(i, answers, custom)}
            />
          ))}

          <div className="btn-group" style={{ marginTop: '28px' }}>
            <Button variant="secondary" onClick={onStartOver}>
              Start Over
            </Button>
            <Button onClick={submitRefinements}>
              Re-evaluate with Answers
            </Button>
          </div>
        </div>
      ) : (
        <div className="success-box">
          <p className="success-title">Your prompt is ready!</p>
          <p className="success-subtitle">Copy it and use it with any AI assistant.</p>
        </div>
      )}

      {isComplete && (
        <div className="btn-group" style={{ marginTop: '24px' }}>
          <Button variant="secondary" onClick={onStartOver}>
            Create New Prompt
          </Button>
          <Button onClick={copyPrompt}>
            Copy Prompt
          </Button>
        </div>
      )}
    </div>
  );
}
