// All coordinates are CSS pixels within the webview, independent of desktop DPI.
export function placeOverlay(anchor, size, viewport, gap = 6, margin = 8) {
  const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
  const anchorTop = Math.max(margin, Math.min(anchor.top, viewport.height - margin));
  const anchorBottom = Math.max(margin, Math.min(anchor.bottom, viewport.height - margin));
  const below = Math.max(0, viewport.height - margin - anchorBottom - gap);
  const above = Math.max(0, anchorTop - margin - gap);
  const useAbove = size.height > below && above > below;
  const height = Math.min(size.height, useAbove ? above : below);
  return {
    left: Math.max(margin, Math.min(anchor.left, viewport.width - margin - width)),
    top: useAbove ? Math.max(margin, anchorTop - gap - height) : Math.min(viewport.height - margin, anchorBottom + gap),
    maxWidth: Math.max(0, viewport.width - margin * 2),
    maxHeight: height,
  };
}
