interface ToolbarProps {
  onSave?: () => void;
  onLoad?: () => void;
  onReset?: () => void;
}

export function Toolbar({ onSave, onLoad, onReset }: ToolbarProps) {
  return (
    <div className="toolbar">
      {onSave && (
        <button className="toolbar-btn" onClick={onSave}>
          Save
        </button>
      )}
      {onLoad && (
        <button className="toolbar-btn" onClick={onLoad}>
          Load
        </button>
      )}
      {onReset && (
        <button className="toolbar-btn" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}
