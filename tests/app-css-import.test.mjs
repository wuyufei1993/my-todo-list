import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const mainSource = readFileSync(path.join(projectRoot, 'src', 'main.jsx'), 'utf8');
const appSource = readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf8');

const importsAppCss =
  /import\s+['\"]\.\/App\.css['\"];?/.test(mainSource) ||
  /import\s+['\"]\.\/App\.css['\"];?/.test(appSource);

assert.equal(
  importsAppCss,
  true,
  'App.css 必须被入口或 App 组件显式引入，否则拖拽与点击区域样式不会生效。'
);

console.log('PASS: App.css 已被正确引入');
