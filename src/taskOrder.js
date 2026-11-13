// Keep the existing automatic order until the user first rearranges tasks.
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aOrdered = Number.isFinite(a.order);
    const bOrdered = Number.isFinite(b.order);
    // Newly added/restored tasks appear before manually ordered tasks.
    if (aOrdered !== bOrdered) return aOrdered ? 1 : -1;
    if (aOrdered && a.order !== b.order) return a.order - b.order;
    if (a.pinned) return b.timestamp - a.timestamp;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return b.timestamp - a.timestamp;
  });
}

export function reorderTasks(tasks, sourceId, targetId, placement) {
  if (sourceId === targetId || !['before', 'after'].includes(placement)) return tasks;
  const ordered = sortTasks(tasks);
  const source = ordered.find(task => task.id === sourceId);
  const target = ordered.find(task => task.id === targetId);
  if (!source || !target || Boolean(source.pinned) !== Boolean(target.pinned)) return tasks;
  const remaining = ordered.filter(task => task.id !== sourceId);
  const index = remaining.findIndex(task => task.id === targetId);
  remaining.splice(index + (placement === 'after' ? 1 : 0), 0, source);
  if (remaining.every((task, i) => task.id === ordered[i].id)) return tasks;
  return remaining.map((task, order) => ({ ...task, order }));
}
