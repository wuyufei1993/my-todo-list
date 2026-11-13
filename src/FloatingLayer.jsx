import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { placeOverlay } from './layout';

export default function FloatingLayer({ anchor, className, children, role }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const position = () => {
      element.style.maxHeight = '';
      element.style.maxWidth = `${Math.max(0, window.innerWidth - 16)}px`;
      const bounds = placeOverlay(anchor, {
        width: element.offsetWidth,
        height: element.scrollHeight + 2,
      }, { width: window.innerWidth, height: window.innerHeight });
      Object.assign(element.style, Object.fromEntries(
        Object.entries(bounds).map(([key, value]) => [key, `${value}px`]),
      ));
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [anchor, children]);

  return createPortal(<div ref={ref} className={className} role={role}>{children}</div>, document.body);
}
