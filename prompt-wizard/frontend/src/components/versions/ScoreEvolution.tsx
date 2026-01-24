import type { ScoreEvolutionItem } from '../../api/types';

interface ScoreEvolutionProps {
  data: ScoreEvolutionItem[];
}

export function ScoreEvolution({ data }: ScoreEvolutionProps) {
  const maxScore = 30;
  const chartHeight = 120;

  // Filter out entries without scores
  const validData = data.filter(d => d.total_score !== null);

  if (validData.length < 2) return null;

  return (
    <div style={{
      background: '#faf7f4',
      padding: '20px',
      borderRadius: '10px',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', justifyContent: 'center' }}>
        {validData.map((item, i) => {
          const score = item.total_score || 0;
          const heightPercent = (score / maxScore) * 100;
          const isImproved = i > 0 && score > (validData[i - 1].total_score || 0);

          return (
            <div key={item.version_number} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isImproved ? '#166534' : '#191919',
                marginBottom: '4px'
              }}>
                {score}
                {isImproved && ' ↑'}
              </div>
              <div style={{
                width: '40px',
                height: `${chartHeight}px`,
                background: '#f0e8e0',
                borderRadius: '4px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
              }}>
                <div style={{
                  width: '100%',
                  height: `${heightPercent}%`,
                  background: score >= 25
                    ? 'linear-gradient(to top, #22c55e, #4ade80)'
                    : 'linear-gradient(to top, #e87843, #f59e0b)',
                  transition: 'height 0.3s',
                }} />
              </div>
              <div style={{ fontSize: '12px', color: '#7a6f66', marginTop: '4px' }}>
                v{item.version_number}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#7a6f66' }}>
        Score progression over versions
      </div>
    </div>
  );
}
