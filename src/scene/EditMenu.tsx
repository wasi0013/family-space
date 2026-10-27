import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/** One place to change what's in the sky: the people, or the moments. */
export function EditMenu({ onEditPeople, onEditMoments }: { onEditPeople: () => void; onEditMoments: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="keep" ref={rootRef}>
      <button type="button" className="scene-action" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t.edit}
      </button>
      {open && (
        <div className="keep-menu edit-menu" role="menu">
          <button type="button" role="menuitem" className="keep-option" onClick={onEditPeople}>
            <span className="keep-option-title">{t.editPeople}</span>
          </button>
          <button type="button" role="menuitem" className="keep-option" onClick={onEditMoments}>
            <span className="keep-option-title">{t.editMoments}</span>
          </button>
        </div>
      )}
    </div>
  );
}
