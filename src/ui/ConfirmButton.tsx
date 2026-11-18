import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Text of the first button. */
  label: ReactNode;
  /** The question shown when asking, e.g. "Delete this lesson?" */
  question: string;
  /** Text of the button that carries out the action, e.g. "Delete". */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Two-step button for destructive actions. The confirmation happens in the page instead of a
 * browser `confirm()` dialog, which embedded views (LMS frames, school portals) often block.
 * Focus moves to the confirm button; Escape cancels.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className = 'btn',
  disabled = false,
}: Props) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      className="confirm-inline"
      role="group"
      aria-label={question}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setAsking(false);
      }}
    >
      <span className="confirm-question">{question}</span>
      <button
        ref={confirmRef}
        type="button"
        className="btn btn-small btn-danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-small btn-ghost" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
