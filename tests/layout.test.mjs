import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOverlay } from '../src/layout.js';

test('bottom-right context menu flips up and fits a 350×300 widget', () => {
  const position = placeOverlay({ left: 343, top: 285, bottom: 285 }, { width: 180, height: 150 }, { width: 350, height: 300 });
  assert.ok(position.left >= 8 && position.left + 180 <= 342);
  assert.ok(position.top >= 8 && position.top + position.maxHeight < 285);
  assert.equal(position.maxHeight, 150);
});

test('long tooltip is constrained to the larger available side', () => {
  const position = placeOverlay({ left: 10, top: 130, bottom: 170 }, { width: 310, height: 600 }, { width: 350, height: 300 });
  assert.ok(position.maxHeight <= 116);
  assert.ok(position.top + position.maxHeight <= 292);
});

test('top row tooltip opens down and narrow viewports constrain width', () => {
  const position = placeOverlay({ left: 10, top: 45, bottom: 90 }, { width: 310, height: 100 }, { width: 280, height: 400 });
  assert.equal(position.top, 96);
  assert.equal(position.maxWidth, 264);
  assert.equal(position.left, 8);
});

test('open menu remains inside the viewport after the window shrinks', () => {
  const position = placeOverlay({ left: 340, top: 700, bottom: 700 }, { width: 180, height: 150 }, { width: 350, height: 300 });
  assert.ok(position.top >= 8 && position.top + position.maxHeight <= 292);
});
