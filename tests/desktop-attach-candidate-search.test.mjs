import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const mainRs = readFileSync(path.join(projectRoot, 'src-tauri', 'src', 'main.rs'), 'utf8');

assert.match(
  mainRs,
  /class_name_str\s*!=\s*"Progman"\s*&&\s*class_name_str\s*!=\s*"WorkerW"/,
  '候选窗口筛选应同时覆盖 Progman 与 WorkerW，避免把桌面宿主固定死在 Progman。'
);

assert.match(
  mainRs,
  /FindWindowExW\(hwnd,\s*None,\s*w!\("SHELLDLL_DefView"\),\s*None\)/,
  '候选窗口下应继续检查是否存在 SHELLDLL_DefView。'
);

assert.match(
  mainRs,
  /if\s+class_name_str\s*==\s*"WorkerW"\s*\{\s*state\.worker\s*=\s*Some\(hwnd\);/,
  '当 SHELLDLL_DefView 挂在 WorkerW 自身下时，应直接将该 WorkerW 作为附着目标。'
);

console.log('PASS: desktop attach candidate search covers Progman and WorkerW');
