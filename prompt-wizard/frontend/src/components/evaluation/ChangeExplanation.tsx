interface ChangeExplanationProps {
  explanation: string;
}

export function ChangeExplanation({ explanation }: ChangeExplanationProps) {
  if (!explanation) return null;

  return (
    <div className="change-box">
      <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#191919', marginBottom: '10px' }}>
        What Changed
      </h3>
      <p style={{ color: '#6b6560', fontSize: '15px', lineHeight: 1.7 }}>
        {explanation}
      </p>
    </div>
  );
}
