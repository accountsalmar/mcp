import type { Prompt } from '../../api/types';
import { PromptItem } from './PromptItem';

interface PromptListProps {
  prompts: Prompt[];
  onLoad: (id: number) => void;
  onDelete: (id: number, name: string) => void;
  deletingId: number | null;
}

export function PromptList({ prompts, onLoad, onDelete, deletingId }: PromptListProps) {
  return (
    <div>
      {prompts.map(prompt => (
        <PromptItem
          key={prompt.id}
          prompt={prompt}
          onLoad={() => onLoad(prompt.id)}
          onDelete={() => onDelete(prompt.id, prompt.name)}
          isDeleting={deletingId === prompt.id}
        />
      ))}
    </div>
  );
}
