interface ScoreCardProps {
  totalScore: number;
  percentageScore: number;
  productScore: number;
  processScore: number;
  performanceScore: number;
  previousScore?: number | null;
}

function getRating(percentage: number): string {
  if (percentage >= 85) return 'Excellent';
  if (percentage >= 70) return 'Good';
  if (percentage >= 50) return 'Adequate';
  return 'Needs Improvement';
}

export function ScoreCard({
  totalScore,
  percentageScore,
  productScore,
  processScore,
  performanceScore,
  previousScore,
}: ScoreCardProps) {
  const rating = getRating(percentageScore);
  const improvement = previousScore !== null && previousScore !== undefined
    ? totalScore - previousScore
    : null;

  return (
    <div className="score-card">
      <div className="score-value">{totalScore}/30</div>
      <div className="score-label">
        {percentageScore}% - {rating}
        {improvement !== null && improvement > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            ↑ Improved by {improvement} points
          </div>
        )}
      </div>
      <div className="score-breakdown">
        <div className="score-item">
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{productScore}/10</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Product</div>
        </div>
        <div className="score-item">
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{processScore}/10</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Process</div>
        </div>
        <div className="score-item">
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{performanceScore}/10</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Performance</div>
        </div>
      </div>
    </div>
  );
}
