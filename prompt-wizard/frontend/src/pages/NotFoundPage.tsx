import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';

function NotFoundPage() {
  return (
    <div className="container">
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h1 className="title" style={{ marginBottom: '12px' }}>Page Not Found</h1>
          <p className="subtitle" style={{ marginBottom: '24px' }}>
            The page you're looking for doesn't exist.
          </p>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Go Home
            </Link>
            <Link to="/prompts" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              View Saved Prompts
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default NotFoundPage;
