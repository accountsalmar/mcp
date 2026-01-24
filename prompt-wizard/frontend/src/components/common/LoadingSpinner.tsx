interface LoadingSpinnerProps {
  text?: string;
  subtext?: string;
}

export function LoadingSpinner({ text, subtext }: LoadingSpinnerProps) {
  return (
    <div className="loading">
      <div className="loading-spinner" />
      {text && <h3 className="loading-text">{text}</h3>}
      {subtext && <p className="loading-subtext">{subtext}</p>}
    </div>
  );
}
