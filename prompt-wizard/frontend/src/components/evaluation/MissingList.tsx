interface MissingListProps {
  items: string[];
}

export function MissingList({ items }: MissingListProps) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="section-title">→ Critical Missing Elements</div>
      {items.map((item, i) => (
        <div key={i} className="list-item">
          <span style={{ color: '#e87843' }}>→</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}
