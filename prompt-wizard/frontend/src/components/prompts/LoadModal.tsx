import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { PromptList } from './PromptList';
import { usePrompts } from '../../context/PromptContext';
import { useWizard } from '../../context/WizardContext';
import { useToast } from '../../context/ToastContext';
import { promptsApi } from '../../api/prompts';

interface LoadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoadModal({ isOpen, onClose }: LoadModalProps) {
  const { prompts, loading, error, refreshPrompts, deletePrompt } = usePrompts();
  const { loadState, goToStep } = useWizard();
  const { showSuccess, showError } = useToast();
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshPrompts();
    }
  }, [isOpen, refreshPrompts]);

  const handleLoad = async (promptId: number) => {
    try {
      const { prompt, latestVersion } = await promptsApi.getById(promptId);

      if (!latestVersion) {
        showError('This prompt has no saved versions');
        return;
      }

      // Parse JSON fields if they exist
      const parsedAnswers = latestVersion.answers ? JSON.parse(latestVersion.answers) : {};
      const parsedStrengths = latestVersion.strengths ? JSON.parse(latestVersion.strengths) : [];
      const parsedMissing = latestVersion.critical_missing ? JSON.parse(latestVersion.critical_missing) : [];
      const parsedQuestions = latestVersion.questions ? JSON.parse(latestVersion.questions) : [];

      // Load state into wizard
      loadState({
        product: latestVersion.product,
        process: latestVersion.process || '',
        performance: latestVersion.performance || '',
        answers: parsedAnswers,
        finalPrompt: latestVersion.final_prompt || '',
        evaluation: latestVersion.total_score !== null ? {
          productScore: latestVersion.product_score || 0,
          processScore: latestVersion.process_score || 0,
          performanceScore: latestVersion.performance_score || 0,
          totalScore: latestVersion.total_score || 0,
          percentageScore: latestVersion.percentage_score || 0,
          strengths: parsedStrengths,
          criticalMissing: parsedMissing,
          questions: parsedQuestions,
        } : null,
        previousScore: latestVersion.total_score || null,
      });

      showSuccess(`Loaded "${prompt.name}"`);
      onClose();

      // Navigate to appropriate step
      if (latestVersion.total_score !== null) {
        goToStep(3);
      } else {
        goToStep(2);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load prompt');
    }
  };

  const handleDelete = async (promptId: number, promptName: string) => {
    if (!confirm(`Delete "${promptName}"?`)) return;

    setDeleting(promptId);
    try {
      await deletePrompt(promptId);
      showSuccess(`Deleted "${promptName}"`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Load Saved Prompt">
      {loading ? (
        <p style={{ color: '#666' }}>Loading...</p>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : prompts.length === 0 ? (
        <div className="no-saved">
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No saved prompts yet</p>
          <p style={{ fontSize: '14px' }}>Create a prompt and click Save.</p>
        </div>
      ) : (
        <PromptList
          prompts={prompts}
          onLoad={handleLoad}
          onDelete={handleDelete}
          deletingId={deleting}
        />
      )}
      <div className="btn-group" style={{ marginTop: '20px' }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
