interface StrengthsListProps {
  strengths: string[];
}

export function StrengthsList({ strengths }: StrengthsListProps) {
  if (!strengths || strengths.length === 0) return null;

  return (
    <div>
      <div className="section-title">✓ Strong Areas</div>
      {strengths.map((strength, i) => (
        <div key={i} className="list-item">
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>{strength}</span>
        </div>
      ))}
    </div>
  );
}
