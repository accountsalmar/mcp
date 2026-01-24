import { Button } from '../common/Button';
import { useWizard } from '../../context/WizardContext';

interface ReviewStepProps {
  onBack: () => void;
  onContinue: () => void;
  loading?: boolean;
}

export function ReviewStep({ onBack, onContinue, loading }: ReviewStepProps) {
  const { product, process, performance, complexity } = useWizard();

  return (
    <div>
      <h2 style={{ fontSize: '21px', fontWeight: 600, marginBottom: '20px', color: '#191919' }}>
        Review Your Input
      </h2>

      <div className="review-section">
        <div className="review-title">Product</div>
        <div className="review-content">{product}</div>
      </div>

      {process && (
        <div className="review-section">
          <div className="review-title">Process</div>
          <div className="review-content">{process}</div>
        </div>
      )}

      {performance && (
        <div className="review-section">
          <div className="review-title">Performance</div>
          <div className="review-content">{performance}</div>
        </div>
      )}

      <div className="review-section">
        <div className="review-title">Complexity</div>
        <div className="review-content">
          {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
        </div>
      </div>

      <div className="btn-group">
        <Button variant="secondary" onClick={onBack} disabled={loading}>
          ← Back
        </Button>
        <Button onClick={onContinue} disabled={loading}>
          {loading ? 'Generating...' : 'Generate & Evaluate →'}
        </Button>
      </div>
    </div>
  );
}
