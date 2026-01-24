import type { Prompt } from '../../api/types';

interface PromptItemProps {
  prompt: Prompt;
  onLoad: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function PromptItem({ prompt, onLoad, onDelete, isDeleting }: PromptItemProps) {
  const date = new Date(prompt.updated_at).toLocaleDateString();

  return (
    <div className="saved-item">
      <div className="saved-item-info" onClick={onLoad}>
        <div className="saved-item-name">{prompt.name}</div>
        <div className="saved-item-meta">Last updated: {date}</div>
      </div>
      <div className="saved-item-actions">
        <button className="saved-item-btn load" onClick={onLoad}>
          Load
        </button>
        <button
          className="saved-item-btn delete"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
