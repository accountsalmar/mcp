import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  optional?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, optional, className = '', ...props }, ref) => {
    return (
      <div className="form-group">
        {label && (
          <label className="label">
            {label}
            {optional !== undefined && (
              <span className="optional">{optional ? '(Optional)' : '(Required)'}</span>
            )}
          </label>
        )}
        <textarea ref={ref} className={className} {...props} />
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
