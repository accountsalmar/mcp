import { Button } from '../common/Button';

interface PromptPreviewProps {
  prompt: string;
  onCopy: () => void;
}

export function PromptPreview({ prompt, onCopy }: PromptPreviewProps) {
  return (
    <div className="prompt-box">
      <div className="prompt-header">
        <h3 style={{ fontSize: '19px', fontWeight: 600, margin: 0 }}>Generated Prompt</h3>
        <Button onClick={onCopy} style={{ padding: '10px 18px', fontSize: '14px' }}>
          Copy Prompt
        </Button>
      </div>
      <div className="prompt-text">{prompt}</div>
    </div>
  );
}
