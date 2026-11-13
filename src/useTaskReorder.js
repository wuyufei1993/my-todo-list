import { useEffect, useRef, useState } from 'react';

export default function useTaskReorder(onReorder, onStart) {
  const listRef = useRef(null);
  const sessionRef = useRef(null);
  const frameRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const cancel = () => {
    cancelAnimationFrame(frameRef.current);
    sessionRef.current = null;
    setDrag(null);
  };

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', cancel);
      cancelAnimationFrame(frameRef.current);
      sessionRef.current = null;
    };
  }, []);

  const updateTarget = session => {
    const list = listRef.current;
    const bounds = list.getBoundingClientRect();
    const inside = session.x >= bounds.left && session.x <= bounds.right
      && session.y >= bounds.top && session.y <= bounds.bottom;
    let target = null;
    if (inside) {
      const rows = [...list.querySelectorAll('[data-task-id]')]
        .filter(row => row.dataset.pinned === session.pinned);
      const row = rows.find(row => row.getBoundingClientRect().bottom >= session.y) || rows.at(-1);
      if (row && row.dataset.taskId !== session.sourceId) {
        const rect = row.getBoundingClientRect();
        target = {
          targetId: row.dataset.taskId,
          placement: session.y < rect.top + rect.height / 2 ? 'before' : 'after',
        };
      }
    }
    session.target = target;
    setDrag(previous => {
      const next = { sourceId: session.sourceId, ...target };
      return previous?.sourceId === next.sourceId && previous?.targetId === next.targetId
        && previous?.placement === next.placement ? previous : next;
    });
  };

  const tick = () => {
    const session = sessionRef.current;
    const list = listRef.current;
    if (!session || !list) return;
    if (session.active) {
      const bounds = list.getBoundingClientRect();
      if (session.x >= bounds.left && session.x <= bounds.right
        && session.y >= bounds.top && session.y <= bounds.bottom) {
        const edge = Math.min(32, bounds.height / 3);
        const speed = session.y < bounds.top + edge
          ? -Math.ceil((bounds.top + edge - session.y) / 4)
          : session.y > bounds.bottom - edge
            ? Math.ceil((session.y - bounds.bottom + edge) / 4) : 0;
        list.scrollTop += speed;
      }
      updateTarget(session);
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const handleProps = task => ({
    onPointerDown: event => {
      if (event.button !== 0 || sessionRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      sessionRef.current = {
        sourceId: task.id, pinned: String(Boolean(task.pinned)), pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
        active: false, target: null,
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    onPointerMove: event => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      session.x = event.clientX;
      session.y = event.clientY;
      if (!session.active && Math.hypot(session.x - session.startX, session.y - session.startY) >= 5) {
        session.active = true;
        onStart();
      }
      if (session.active) updateTarget(session);
    },
    onPointerUp: event => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (session.active) {
        session.x = event.clientX;
        session.y = event.clientY;
        updateTarget(session);
        if (session.target) onReorder(session.sourceId, session.target.targetId, session.target.placement);
      }
      cancel();
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick: event => event.stopPropagation(),
    onDoubleClick: event => event.stopPropagation(),
  });

  return { listRef, drag, handleProps };
}
