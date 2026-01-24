import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ComplexitySelector } from './ComplexitySelector';
import { useWizard } from '../../context/WizardContext';

interface DefineStepProps {
  onContinue: () => void;
}

export function DefineStep({ onContinue }: DefineStepProps) {
  const { product, setProduct, process, setProcess, performance, setPerformance } = useWizard();

  const handleContinue = () => {
    if (!product.trim()) {
      alert('Please provide at least a Product Description');
      return;
    }
    onContinue();
  };

  return (
    <div>
      <Textarea
        label="Product"
        optional={false}
        value={product}
        onChange={e => setProduct(e.target.value)}
        rows={4}
        placeholder="What do you want the AI to create? Be specific about the output format, audience, and style."
        hint='Example: "A professional email to clients explaining our new pricing structure, formal tone, under 300 words"'
      />

      <Textarea
        label="Process"
        optional={true}
        value={process}
        onChange={e => setProcess(e.target.value)}
        rows={4}
        placeholder="How should the AI approach this task? What methodology or steps should it follow?"
        hint='Example: "First analyze the key changes, then structure with intro-body-conclusion, include specific examples"'
      />

      <Textarea
        label="Performance"
        optional={true}
        value={performance}
        onChange={e => setPerformance(e.target.value)}
        rows={4}
        placeholder="What role should the AI play? What constraints or style requirements?"
        hint='Example: "Act as a senior communications specialist, avoid jargon, be empathetic to customer concerns"'
      />

      <ComplexitySelector text={product} />

      <div className="btn-group">
        <Button onClick={handleContinue}>Continue →</Button>
      </div>
    </div>
  );
}
