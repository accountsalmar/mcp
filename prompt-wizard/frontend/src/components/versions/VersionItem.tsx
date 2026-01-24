import type { PromptVersion } from '../../api/types';

interface VersionItemProps {
  version: PromptVersion;
  onLoad?: () => void;
}

export function VersionItem({ version, onLoad }: VersionItemProps) {
  const date = new Date(version.created_at).toLocaleString();

  return (
    <div className="saved-item">
      <div className="saved-item-info" onClick={onLoad}>
        <div className="saved-item-name">
          Version {version.version_number}
          {version.total_score != null && (
            <span style={{
              marginLeft: '12px',
              padding: '2px 8px',
              background: (version.total_score ?? 0) >= 25 ? '#dcfce7' : '#fef3c7',
              color: (version.total_score ?? 0) >= 25 ? '#166534' : '#854d0e',
              borderRadius: '4px',
              fontSize: '12px',
            }}>
              {version.total_score}/30
            </span>
          )}
        </div>
        <div className="saved-item-meta">
          Created: {date}
          {version.product && ` • "${version.product.substring(0, 40)}..."`}
        </div>
      </div>
      {onLoad && (
        <div className="saved-item-actions">
          <button className="saved-item-btn load" onClick={onLoad}>
            Load
          </button>
        </div>
      )}
    </div>
  );
}
