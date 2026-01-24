import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Header } from '../components/layout/Header';
import { Toolbar } from '../components/layout/Toolbar';
import { WizardContainer } from '../components/wizard/WizardContainer';
import { SaveModal } from '../components/prompts/SaveModal';
import { LoadModal } from '../components/prompts/LoadModal';
import { useWizard } from '../context/WizardContext';
import { useToast } from '../context/ToastContext';

function HomePage() {
  const { reset, product } = useWizard();
  const { showSuccess } = useToast();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const handleReset = () => {
    if (confirm('Reset all progress?')) {
      reset();
      showSuccess('Wizard reset');
    }
  };

  const handleSave = () => {
    if (!product.trim()) {
      alert('Please enter a Product description before saving');
      return;
    }
    setShowSaveModal(true);
  };

  const handleLoad = () => {
    setShowLoadModal(true);
  };

  return (
    <div className="container">
      <Card>
        <Header
          title="Prompt Generation Wizard"
          subtitle="Create effective prompts using the 4P/4D Framework"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <Toolbar
            onSave={handleSave}
            onLoad={handleLoad}
            onReset={handleReset}
          />
          <Link
            to="/prompts"
            style={{
              color: '#e87843',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            View All Saved Prompts →
          </Link>
        </div>

        <WizardContainer />
      </Card>

      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
      />

      <LoadModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
      />
    </div>
  );
}

export default HomePage;
