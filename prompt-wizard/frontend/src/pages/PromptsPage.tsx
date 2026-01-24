import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Header } from '../components/layout/Header';
import { PromptList } from '../components/prompts/PromptList';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function PromptsPage() {
  const { prompts, loading, error, refreshPrompts, deletePrompt } = usePrompts();
  const { showSuccess, showError } = useToast();
  const [deleting, setDeleting] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleLoad = (promptId: number) => {
    navigate(`/prompts/${promptId}`);
  };

  const handleDelete = async (promptId: number, promptName: string) => {
    if (!confirm(`Delete "${promptName}" and all its versions?`)) return;

    setDeleting(promptId);
    try {
      await deletePrompt(promptId);
      showSuccess(`Deleted "${promptName}"`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="container">
      <Card>
        <Header
          title="Saved Prompts"
          subtitle="View and manage your saved prompts"
        />

        <div className="toolbar">
          <Link to="/" className="toolbar-btn" style={{ textDecoration: 'none' }}>
            ← Back to Wizard
          </Link>
          <button className="toolbar-btn" onClick={() => refreshPrompts()}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            Loading prompts...
          </p>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : prompts.length === 0 ? (
          <div className="no-saved">
            <p style={{ fontSize: '18px', marginBottom: '12px' }}>No saved prompts yet</p>
            <p style={{ fontSize: '14px', color: '#7a6f66' }}>
              Create a prompt using the wizard and click Save.
            </p>
            <div className="btn-group" style={{ justifyContent: 'center', marginTop: '20px' }}>
              <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Create Your First Prompt
              </Link>
            </div>
          </div>
        ) : (
          <PromptList
            prompts={prompts}
            onLoad={handleLoad}
            onDelete={handleDelete}
            deletingId={deleting}
          />
        )}
      </Card>
    </div>
  );
}

export default PromptsPage;
