import { useState, useCallback } from 'react';
import { useWizard } from '../context/WizardContext';
import { useToast } from '../context/ToastContext';
import { evaluationApi } from '../api/evaluation';

interface QuestionAnswers {
  selectedAnswers: string[];
  customAnswer: string;
}

export function useEvaluation() {
  const {
    product,
    process,
    performance,
    answers,
    evaluation,
    finalPrompt,
    previousScore,
    setAnswer,
    setEvaluation,
    setFinalPrompt,
    setPreviousScore,
  } = useWizard();
  const { showError, showSuccess } = useToast();

  const [questionAnswers, setQuestionAnswers] = useState<Record<number, QuestionAnswers>>({});
  const [loading, setLoading] = useState(false);

  const updateQuestionAnswer = useCallback((index: number, selectedAnswers: string[], customAnswer: string) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [index]: { selectedAnswers, customAnswer },
    }));
  }, []);

  const submitRefinements = useCallback(async () => {
    if (!evaluation) return;

    // Collect new answers
    const newAnswers: Record<string, string> = {};

    evaluation.questions.forEach((q, i) => {
      const qa = questionAnswers[i];
      if (!qa) return;

      let answerValue = '';
      if (qa.customAnswer) {
        answerValue = qa.customAnswer;
      } else if (qa.selectedAnswers.length > 0) {
        answerValue = qa.selectedAnswers.join(' | ');
      }

      if (answerValue) {
        newAnswers[q.question] = answerValue;
      }
    });

    if (Object.keys(newAnswers).length === 0) {
      showError('Please answer at least one question before re-evaluating.');
      return;
    }

    // Merge with existing answers
    const mergedAnswers = { ...answers, ...newAnswers };
    Object.entries(mergedAnswers).forEach(([question, answer]) => {
      setAnswer(question, answer);
    });

    setLoading(true);
    try {
      // Re-generate prompt with new answers
      const generationResult = await evaluationApi.generate({
        product,
        process: process || undefined,
        performance: performance || undefined,
        answers: mergedAnswers,
      });
      setFinalPrompt(generationResult.prompt);

      // Re-evaluate with reevaluation flag
      const evaluationResult = await evaluationApi.evaluate({
        product,
        process: process || undefined,
        performance: performance || undefined,
        answers: mergedAnswers,
        isReevaluation: true,
        previousScore: previousScore || undefined,
      });

      setEvaluation(evaluationResult);
      setPreviousScore(evaluationResult.totalScore);
      setQuestionAnswers({}); // Clear for next round
      showSuccess(`Score improved to ${evaluationResult.totalScore}/30!`);
    } catch (error) {
      console.error('Re-evaluation failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to re-evaluate prompt');
    } finally {
      setLoading(false);
    }
  }, [
    evaluation,
    questionAnswers,
    answers,
    product,
    process,
    performance,
    previousScore,
    setAnswer,
    setEvaluation,
    setFinalPrompt,
    setPreviousScore,
    showError,
    showSuccess,
  ]);

  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(finalPrompt);
    showSuccess('Prompt copied to clipboard!');
  }, [finalPrompt, showSuccess]);

  return {
    evaluation,
    finalPrompt,
    previousScore,
    questionAnswers,
    loading,
    updateQuestionAnswer,
    submitRefinements,
    copyPrompt,
  };
}
