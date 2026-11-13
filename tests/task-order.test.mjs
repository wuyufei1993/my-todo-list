import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTasks, reorderTasks } from '../src/taskOrder.js';

const task = (id, fields = {}) => ({ id, title: id, pinned: false, timestamp: 1, deadline: null, ...fields });
const ids = tasks => sortTasks(tasks).map(task => task.id);

test('legacy tasks retain pin, deadline and recency ordering without modifying input', () => {
  const tasks = [task('old'), task('new', { timestamp: 2 }),
    task('later', { deadline: '2026-12-01' }), task('earlier', { deadline: '2026-11-01' }),
    task('pinned', { pinned: true })];
  const snapshot = structuredClone(tasks);
  assert.deepEqual(ids(tasks), ['pinned', 'earlier', 'later', 'new', 'old']);
  assert.deepEqual(tasks, snapshot);
});

test('moving down and up overrides deadlines and survives a JSON save/reload', () => {
  const tasks = [task('a', { deadline: '2026-11-01' }), task('b', { timestamp: 2 }), task('c')];
  const down = reorderTasks(tasks, 'a', 'c', 'after');
  assert.deepEqual(ids(JSON.parse(JSON.stringify(down))), ['b', 'c', 'a']);
  const up = reorderTasks(down, 'a', 'b', 'before');
  assert.deepEqual(ids(up), ['a', 'b', 'c']);
  assert.equal(tasks[0].order, undefined);
});

test('manual order remains after editing a deadline or completing another task', () => {
  const tasks = reorderTasks([task('a', { timestamp: 3 }), task('b', { timestamp: 2 }), task('c')], 'c', 'a', 'before');
  const edited = tasks.map(item => item.id === 'b' ? { ...item, deadline: '2020-01-01' } : item);
  assert.deepEqual(ids(edited), ['c', 'a', 'b']);
  assert.deepEqual(ids(edited.filter(item => item.id !== 'a')), ['c', 'b']);
});

test('pins stay first and can be reordered independently', () => {
  const tasks = [task('a', { pinned: true, timestamp: 3 }), task('b', { pinned: true, timestamp: 2 }), task('c')];
  assert.deepEqual(ids(reorderTasks(tasks, 'b', 'a', 'before')), ['b', 'a', 'c']);
  assert.equal(reorderTasks(tasks, 'c', 'a', 'before'), tasks);
  assert.equal(reorderTasks(tasks, 'a', 'c', 'after'), tasks);
});

test('new and restored tasks lead their group without scrambling existing manual order', () => {
  const tasks = reorderTasks([task('a', { timestamp: 3 }), task('b', { timestamp: 2 }), task('c')], 'c', 'a', 'before');
  const added = [...tasks, task('new', { timestamp: 4 }), task('restored', { timestamp: 5, order: null })];
  assert.deepEqual(ids(added), ['restored', 'new', 'c', 'a', 'b']);
  assert.deepEqual(ids(reorderTasks(added, 'new', 'a', 'after')), ['restored', 'c', 'a', 'new', 'b']);
});

test('missing targets, self drops and unchanged positions do not write a new order', () => {
  const tasks = [task('a', { timestamp: 2 }), task('b')];
  for (const args of [['a', 'a', 'after'], ['a', 'missing', 'before'], ['missing', 'a', 'after'],
    ['a', 'b', 'before'], ['b', 'a', 'after'], ['a', 'b', 'invalid']]) {
    assert.equal(reorderTasks(tasks, ...args), tasks);
  }
});
