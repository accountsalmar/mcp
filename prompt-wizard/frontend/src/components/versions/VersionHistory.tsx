import { useEffect, useState } from 'react';
import { promptsApi } from '../../api/prompts';
import type { PromptVersion, ScoreEvolutionItem } from '../../api/types';
import { VersionItem } from './VersionItem';
import { ScoreEvolution } from './ScoreEvolution';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface VersionHistoryProps {
  promptId: number;
  onLoadVersion?: (version: PromptVersion) => void;
}

export function VersionHistory({ promptId, onLoadVersion }: VersionHistoryProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [evolution, setEvolution] = useState<ScoreEvolutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [versionsData, evolutionData] = await Promise.all([
          promptsApi.getVersions(promptId),
          promptsApi.getScoreEvolution(promptId),
        ]);
        setVersions(versionsData);
        setEvolution(evolutionData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [promptId]);

  if (loading) {
    return <LoadingSpinner text="Loading version history..." />;
  }

  if (error) {
    return <div className="error-box">{error}</div>;
  }

  if (versions.length === 0) {
    return <p style={{ color: '#666', textAlign: 'center' }}>No versions found.</p>;
  }

  return (
    <div>
      {evolution.length > 1 && (
        <>
          <h3 className="section-title">Score Evolution</h3>
          <ScoreEvolution data={evolution} />
        </>
      )}

      <h3 className="section-title" style={{ marginTop: '24px' }}>
        Version History ({versions.length})
      </h3>
      {versions.map(version => (
        <VersionItem
          key={version.id}
          version={version}
          onLoad={onLoadVersion ? () => onLoadVersion(version) : undefined}
        />
      ))}
    </div>
  );
}
