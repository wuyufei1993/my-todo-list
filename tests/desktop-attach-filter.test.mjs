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
  /GetClassNameW\(hwnd,\s*&mut\s+class_name\)/,
  '在 EnumWindows 回调里，应该先获取当前 hwnd 的 class name，再决定是否继续查找 SHELLDLL_DefView。'
);

assert.match(
  mainRs,
  /if\s+class_name_str\s*!=\s*"Progman"\s*\{\s*return\s+BOOL\(1\);\s*\}/,
  '应先过滤掉非 Progman 窗口，只对明确候选窗口继续查找 SHELLDLL_DefView。'
);

console.log('PASS: desktop attach window filtering is present');
