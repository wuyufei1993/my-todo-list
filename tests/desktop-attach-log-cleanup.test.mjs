import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const mainRs = readFileSync(path.join(projectRoot, 'src-tauri', 'src', 'main.rs'), 'utf8');

assert.doesNotMatch(
  mainRs,
  /EnumWindows hwnd=\{:\?\} class=\{\}/,
  '不应保留高频枚举 class 调试日志。'
);

assert.match(
  mainRs,
  /find_desktop_worker_window selected WorkerW from EnumWindows/,
  '应保留 WorkerW 选取成功日志。'
);

assert.match(
  mainRs,
  /attach aborted: no worker window/,
  '应保留无法找到 worker 的关键失败日志。'
);

console.log('PASS: desktop attach logging is reduced to key signals');
