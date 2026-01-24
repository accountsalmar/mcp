import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Header } from '../components/layout/Header';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { VersionHistory } from '../components/versions/VersionHistory';
import { useWizard } from '../context/WizardContext';
import { useToast } from '../context/ToastContext';
import { promptsApi } from '../api/prompts';
import type { Prompt, PromptVersion } from '../api/types';

function PromptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadState, goToStep } = useWizard();
  const { showSuccess, showError } = useToast();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrompt = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);
      try {
        const data = await promptsApi.getById(parseInt(id, 10));
        setPrompt(data.prompt);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prompt');
      } finally {
        setLoading(false);
      }
    };

    loadPrompt();
  }, [id]);

  const handleLoadVersion = (version: PromptVersion) => {
    try {
      // Parse JSON fields
      const parsedAnswers = version.answers ? JSON.parse(version.answers) : {};
      const parsedStrengths = version.strengths ? JSON.parse(version.strengths) : [];
      const parsedMissing = version.critical_missing ? JSON.parse(version.critical_missing) : [];
      const parsedQuestions = version.questions ? JSON.parse(version.questions) : [];

      // Load state into wizard
      loadState({
        product: version.product,
        process: version.process || '',
        performance: version.performance || '',
        answers: parsedAnswers,
        finalPrompt: version.final_prompt || '',
        evaluation: version.total_score !== null ? {
          productScore: version.product_score || 0,
          processScore: version.process_score || 0,
          performanceScore: version.performance_score || 0,
          totalScore: version.total_score || 0,
          percentageScore: version.percentage_score || 0,
          strengths: parsedStrengths,
          criticalMissing: parsedMissing,
          questions: parsedQuestions,
        } : null,
        previousScore: version.total_score || null,
      });

      showSuccess(`Loaded version ${version.version_number}`);

      // Navigate to wizard and appropriate step
      if (version.total_score !== null) {
        goToStep(3);
      } else {
        goToStep(2);
      }
      navigate('/');
    } catch (err) {
      showError('Failed to load version');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <Card>
          <LoadingSpinner text="Loading prompt..." />
        </Card>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="container">
        <Card>
          <div className="error-box">{error || 'Prompt not found'}</div>
          <div className="btn-group">
            <Link to="/prompts" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              ← Back to Prompts
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container">
      <Card>
        <Header
          title={prompt.name}
          subtitle={`Created: ${new Date(prompt.created_at).toLocaleDateString()}`}
        />

        <div className="toolbar">
          <Link to="/prompts" className="toolbar-btn" style={{ textDecoration: 'none' }}>
            ← Back to Prompts
          </Link>
          <Link to="/" className="toolbar-btn" style={{ textDecoration: 'none' }}>
            Open Wizard
          </Link>
        </div>

        <VersionHistory
          promptId={prompt.id}
          onLoadVersion={handleLoadVersion}
        />
      </Card>
    </div>
  );
}

export default PromptDetailPage;
