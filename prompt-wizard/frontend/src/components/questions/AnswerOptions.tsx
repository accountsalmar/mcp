import type { EvaluationQuestion } from '../../api/types';

interface AnswerOptionsProps {
  question: EvaluationQuestion;
  selectedAnswers: string[];
  customAnswer: string;
  showCustomInput: boolean;
  onOptionSelect: (option: string, isCustom: boolean) => void;
  onCustomInputChange: (value: string) => void;
}

export function AnswerOptions({
  question,
  selectedAnswers,
  customAnswer,
  showCustomInput,
  onOptionSelect,
  onCustomInputChange,
}: AnswerOptionsProps) {
  const inputType = question.answerType === 'mutually_exclusive' ? 'radio' : 'checkbox';
  const inputName = `question-${question.question.substring(0, 20)}`;

  return (
    <div className="answer-options">
      {question.suggestedAnswers.map((answer, i) => {
        const isSelected = selectedAnswers.includes(answer.technical);

        return (
          <label
            key={i}
            className={`answer-option ${isSelected ? 'selected' : ''}`}
            onClick={() => onOptionSelect(answer.technical, false)}
          >
            <input
              type={inputType}
              name={inputName}
              checked={isSelected}
              onChange={() => {}}
            />
            <div className="answer-content">
              <span className="answer-technical">{answer.technical}</span>
              {answer.simple && (
                <span className="answer-simple">
                  <span className="simple-label">In plain English:</span> {answer.simple}
                </span>
              )}
            </div>
          </label>
        );
      })}

      {/* Custom input option */}
      <label
        className={`answer-option custom-option ${showCustomInput ? 'selected' : ''}`}
        onClick={() => onOptionSelect('', true)}
      >
        <input
          type={inputType}
          name={inputName}
          checked={showCustomInput && !!customAnswer}
          onChange={() => {}}
        />
        <span>Provide my own creative input</span>
      </label>

      {showCustomInput && (
        <textarea
          className="custom-input show"
          placeholder="Type your custom answer..."
          rows={2}
          value={customAnswer}
          onChange={e => onCustomInputChange(e.target.value)}
        />
      )}
    </div>
  );
}
