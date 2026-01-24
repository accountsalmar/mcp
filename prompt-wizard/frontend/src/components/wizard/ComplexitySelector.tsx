import { useEffect } from 'react';
import { useWizard } from '../../context/WizardContext';
import { complexityApi } from '../../api/complexity';
import type { ComplexityLevel } from '../../api/types';

const COMPLEXITY_OPTIONS: Array<{
  level: ComplexityLevel;
  label: string;
  description: string;
}> = [
  { level: 'simple', label: 'Simple', description: 'Basic tasks, 9 questions' },
  { level: 'moderate', label: 'Moderate', description: 'Standard tasks, 12 questions' },
  { level: 'complex', label: 'Complex', description: 'Advanced tasks, 15 questions' },
];

interface ComplexitySelectorProps {
  text: string;
}

export function ComplexitySelector({ text }: ComplexitySelectorProps) {
  const { complexity, setComplexity, autoDetectedComplexity, setAutoDetectedComplexity } = useWizard();

  // Auto-detect complexity when text changes
  useEffect(() => {
    if (!text || text.length < 10) {
      setAutoDetectedComplexity(null);
      return;
    }

    const detect = async () => {
      try {
        const result = await complexityApi.detect(text);
        setAutoDetectedComplexity(result.level);
        // Auto-select if user hasn't made a choice
        if (!autoDetectedComplexity) {
          setComplexity(result.level);
        }
      } catch (error) {
        console.error('Complexity detection failed:', error);
      }
    };

    const timeoutId = setTimeout(detect, 500);
    return () => clearTimeout(timeoutId);
  }, [text, setAutoDetectedComplexity, setComplexity, autoDetectedComplexity]);

  return (
    <div className="complexity-selector">
      <label className="label">
        Complexity Level
        <span className="optional">(Affects number of questions)</span>
      </label>
      <div className="complexity-options">
        {COMPLEXITY_OPTIONS.map(option => (
          <div
            key={option.level}
            className={`complexity-option ${complexity === option.level ? 'selected' : ''}`}
            onClick={() => setComplexity(option.level)}
          >
            <strong>{option.label}</strong>
            <br />
            <small>{option.description}</small>
          </div>
        ))}
      </div>
      {autoDetectedComplexity && (
        <p className="complexity-auto">
          Auto-detected: <strong>{autoDetectedComplexity}</strong>
          {complexity !== autoDetectedComplexity && ' (overridden)'}
        </p>
      )}
    </div>
  );
}
