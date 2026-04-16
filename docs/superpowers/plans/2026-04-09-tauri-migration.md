# My Todo List Tauri 迁移与功能增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从 Electron 迁移到 Tauri，并实现自动归档、分组显示、分级加载以及基于截止日期的颜色反馈。

**Architecture:** 
- **Backend (Rust)**: 处理多文件存储 (`todos.json`, `archive.json`, `settings.json`)，实现 Win32 底层置顶逻辑，并提供带日期过滤的归档查询。
- **Frontend (React)**: 实现双标签页切换，归档按日期分组显示，待办根据截止日期计算剩余时间并渲染不同颜色。

**Tech Stack:** Tauri v2, Rust (serde, windows crate), React 19, Lucide React, CSS Variables.

---

### Task 1: 初始化 Tauri 环境与配置

**Files:**
- Create: `src-tauri/`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 运行 Tauri 初始化命令**
Run: `npm run tauri init` (选择默认配置，Window title: "Todo Widget")

- [ ] **Step 2: 配置透明无边框窗口**
修改 `src-tauri/tauri.conf.json`:
```json
"windows": [
  {
    "title": "Todo Widget",
    "width": 350,
    "height": 500,
    "resizable": true,
    "fullscreen": false,
    "decorations": false,
    "transparent": true,
    "alwaysOnTop": true,
    "visible": true
  }
]
```

- [ ] **Step 3: 更新 package.json 脚本**
移除 Electron 相关脚本，添加 Tauri 脚本。
```json
"scripts": {
  "tauri": "tauri",
  "dev": "tauri dev",
  "build": "tauri build"
}
```

- [ ] **Step 4: 提交**
```bash
git add .
git commit -m "chore: initialize tauri and configure transparent window"
```

---

### Task 2: 实现 Rust 后端数据持久化 (带分级加载)

**Files:**
- Create: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 定义数据模型 (Task, Settings)**
在 `models.rs` 中定义结构体，支持 `deadline` 字段。

- [ ] **Step 2: 实现文件读写 Command**
实现 `get_tasks`, `save_tasks`, `get_settings`, `save_settings`。

- [ ] **Step 3: 实现带时间范围的归档查询**
实现 `get_archive(offset_months: u32)`，每次返回 3 个月的数据。

- [ ] **Step 4: 提交**
```bash
git add src-tauri/src
git commit -m "feat: implement rust data persistence with pagination"
```

---

### Task 3: 前端 API 适配与 Tab 切换

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: 替换 Electron API 为 Tauri Invoke**
封装 `invoke('get_tasks')` 等调用。

- [ ] **Step 2: 实现 Todo/Archive 标签页切换 UI**
在 Header 下方增加 Tab 切换按钮。

- [ ] **Step 3: 实现归档日期间隔加载逻辑**
增加“加载更多（3个月）”按钮。

- [ ] **Step 4: 提交**
```bash
git add src/App.jsx src/index.css
git commit -m "feat: frontend api migration and tab switching"
```

---

### Task 4: 待办列表增强 (颜色反馈与排序)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: 实现截止日期计算逻辑**
编写函数根据 `deadline` 计算状态（逾期、今天/明天、3天内）。

- [ ] **Step 2: 应用颜色 CSS 变量**
```css
.todo-item.overdue { border-left: 4px solid #ff4d4f; }
.todo-item.urgent { border-left: 4px solid #faad14; }
.todo-item.upcoming { border-left: 4px solid #1890ff; }
```

- [ ] **Step 3: 实现排序逻辑**
`pinned` 优先，然后按 `deadline` 升序排列（最近的在前）。

- [ ] **Step 4: 提交**
```bash
git commit -m "feat: todo list enhancement with deadline colors and sorting"
```

---

### Task 5: 归档列表分组显示

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 实现日期分组函数**
将归档数组转换为 `{ "2026-03-02": [...], "2026-03-01": [...] }`。

- [ ] **Step 2: 渲染分组视图**
使用嵌套 map 渲染日期标题和任务列表。

- [ ] **Step 3: 提交**
```bash
git commit -m "feat: archive list grouped by date"
```

---

### Task 6: Windows 底层置顶增强 (Win32 API)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 添加 windows crate 依赖**
`cargo add windows --features "Win32_Foundation,Win32_UI_WindowsAndMessaging"`

- [ ] **Step 2: 实现屏蔽 Win+D 的逻辑**
在窗口创建后通过 `SetWindowPos` 设置 `HWND_TOPMOST` 并调整扩展样式。

- [ ] **Step 3: 提交**
```bash
git commit -m "feat: enhance always-on-top using Win32 API"
```

---

### Task 7: 清理与验证

- [ ] **Step 1: 删除 electron 目录**
`rm -rf electron/`

- [ ] **Step 2: 运行完整构建验证**
`npm run build`

- [ ] **Step 3: 最终提交**
```bash
git commit -m "cleanup: remove electron leftovers and final verification"
```
