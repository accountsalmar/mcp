import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useWizard } from '../../context/WizardContext';
import { usePrompts } from '../../context/PromptContext';
import { useToast } from '../../context/ToastContext';
import { promptsApi } from '../../api/prompts';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaveModal({ isOpen, onClose }: SaveModalProps) {
  const { product, process, performance, answers, evaluation, finalPrompt } = useWizard();
  const { createPrompt, refreshPrompts } = usePrompts();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate suggested name from product
  const suggestedName = product
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const handleSave = async () => {
    const saveName = name.trim() || suggestedName;
    if (!saveName) {
      showError('Please enter a name');
      return;
    }

    const cleanName = saveName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_|_$/g, '');
    if (!cleanName) {
      showError('Please enter a valid name (letters, numbers, underscores)');
      return;
    }

    setSaving(true);
    try {
      // Create or get the prompt
      let prompt;
      try {
        prompt = await createPrompt(cleanName);
      } catch (err: any) {
        // If name exists, try to get it
        if (err.statusCode === 409) {
          const prompts = await promptsApi.getAll();
          prompt = prompts.find(p => p.name === cleanName);
          if (!prompt) throw new Error('Could not find or create prompt');
        } else {
          throw err;
        }
      }

      // Create a version
      await promptsApi.createVersion(prompt.id, {
        product,
        process: process || undefined,
        performance: performance || undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        finalPrompt: finalPrompt || undefined,
        evaluation: evaluation ? {
          productScore: evaluation.productScore,
          processScore: evaluation.processScore,
          performanceScore: evaluation.performanceScore,
          totalScore: evaluation.totalScore,
          percentageScore: evaluation.percentageScore,
          strengths: evaluation.strengths,
          criticalMissing: evaluation.criticalMissing,
          questions: evaluation.questions,
        } : undefined,
      });

      await refreshPrompts();
      showSuccess(`Saved as "${cleanName}"`);
      onClose();
      setName('');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save Prompt">
      <p style={{ color: '#666', marginBottom: '12px' }}>Give your prompt a name:</p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={suggestedName || 'e.g., contract_review, email_template'}
        style={{ marginBottom: '16px' }}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
      <p className="hint" style={{ marginBottom: '16px' }}>
        Use lowercase letters, numbers, and underscores.
      </p>
      <div className="btn-group">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
