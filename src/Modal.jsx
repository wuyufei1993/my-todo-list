import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer, className = '' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, input, textarea, [tabindex="0"]')].filter(el => !el.disabled);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first?.focus();
      }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => { dialog.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return createPortal(
    <div className="modal-overlay">
      <section ref={ref} className={`modal-content ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="modal-header"><span>{title}</span><button className="icon-btn" aria-label="关闭弹窗" onClick={onClose}><X size={16}/></button></div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </section>
    </div>, document.body,
  );
}
