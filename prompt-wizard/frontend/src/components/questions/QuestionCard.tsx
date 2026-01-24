import { useState } from 'react';
import type { EvaluationQuestion } from '../../api/types';
import { AnswerOptions } from './AnswerOptions';

interface QuestionCardProps {
  question: EvaluationQuestion;
  index: number;
  selectedAnswers: string[];
  customAnswer: string;
  onAnswerChange: (answers: string[], customAnswer: string) => void;
}

export function QuestionCard({
  question,
  index,
  selectedAnswers,
  customAnswer,
  onAnswerChange,
}: QuestionCardProps) {
  const [showCustomInput, setShowCustomInput] = useState(!!customAnswer);

  const handleOptionSelect = (option: string, isCustom: boolean) => {
    if (isCustom) {
      setShowCustomInput(true);
      return;
    }

    setShowCustomInput(false);

    if (question.answerType === 'mutually_exclusive') {
      // Radio behavior - replace all answers
      onAnswerChange([option], '');
    } else {
      // Checkbox behavior - toggle
      const newAnswers = selectedAnswers.includes(option)
        ? selectedAnswers.filter(a => a !== option)
        : [...selectedAnswers, option];
      onAnswerChange(newAnswers, '');
    }
  };

  const handleCustomInputChange = (value: string) => {
    onAnswerChange([], value);
  };

  return (
    <div className="question-card">
      <div className="question-text">
        {index + 1}. {question.question}
      </div>

      {question.questionSimple && (
        <div className="question-simple">
          <span className="simple-label">In plain English:</span> {question.questionSimple}
        </div>
      )}

      {question.contextDescription && (
        <div className="question-context">
          <span className="context-what">{question.contextDescription.what}</span>
          <span className="context-why">{question.contextDescription.why}</span>
        </div>
      )}

      <AnswerOptions
        question={question}
        selectedAnswers={selectedAnswers}
        customAnswer={customAnswer}
        showCustomInput={showCustomInput}
        onOptionSelect={handleOptionSelect}
        onCustomInputChange={handleCustomInputChange}
      />
    </div>
  );
}
