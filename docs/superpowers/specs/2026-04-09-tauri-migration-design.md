# 设计文档：My Todo List 迁移至 Tauri 并增强归档功能

- **日期**: 2026-04-09
- **状态**: 待审阅
- **目标**: 将现有的 Electron 技术栈迁移至 Tauri，并新增自动归档和双标签页功能，同时保留高级窗口置顶特性。

---

## 1. 架构变更

### 1.1 后端 (Rust)
使用 Tauri 代替 Electron。
- **IPC 框架**: 使用 Tauri `command` 系统。
- **窗口管理**: 通过 `tauri::Window` 控制透明度、边框和层级。
- **原生调用**: 集成 `windows` crate，利用 `SetWindowPos` 等 Win32 API 实现 `HWND_TOPMOST` 和屏蔽 `Win+D` 的效果。

### 1.2 前端 (React)
- **API 层**: 封装 `@tauri-apps/api/core`。
- **状态管理**: 扩展现有任务状态，增加 `view` (todo/archive) 状态。

---

## 2. 数据模型与存储

### 2.1 文件结构
存储于系统的 `AppData/Local/my-todo-list` 目录下：
- `todos.json`: `Array<Task>` (仅 `completed: false`)
- `archive.json`: `Array<Task>` (仅 `completed: true`)
- `settings.json`: `{ opacity: number, fontSize: number, alwaysOnTop: boolean }`

### 2.2 自动归档与性能优化
1. **自动归档**: 用户在 UI 中点击任务完成，前端触发 `archive_task` 命令，后端将任务从 `todos.json` 移除并存入 `archive.json`。
2. **分级加载**: 为了防止归档数据过多影响加载速度，`get_archive` 命令默认仅返回最近 90 天的数据。
3. **按需加载**: Archive 标签页底部增加“查看更早的记录”按钮，点击后向后端请求完整归档列表。

---

## 3. 界面设计 (UI/UX)

### 3.1 顶部标签页
- 在 Header 下方增加两个紧凑的 Tab：**待办 (To-Do)** 和 **归档 (Archive)**。
- 当前活跃 Tab 具有高亮底线。

### 3.2 列表交互
- **待办列表**: 勾选完成即消失。
- **归档列表**: 右键菜单增加“恢复到待办”选项，点击后任务反向流转。

---

## 4. 实施计划

### 阶段 1: 初始化与后端搭建
1. 初始化 Tauri 项目。
2. 配置 `tauri.conf.json` (透明窗口、无边框、无系统装饰)。
3. 实现 Rust 后端的文件读写命令。

### 阶段 2: 前端迁移
1. 安装 `@tauri-apps/api`。
2. 重写 `App.jsx` 中的 API 调用。
3. 实现 Tab 切换逻辑和归档 UI。

### 阶段 3: Windows 特性增强
1. 编写 Rust 插件或在 `setup` 闭包中加入 Win32 置顶代码。
2. 验证 Win+D 屏蔽效果。

### 阶段 4: 清理
1. 删除 `electron/` 目录。
2. 更新 `package.json` 中的脚本。
3. 验证跨平台编译。

---

## 5. 验收标准
- [ ] 窗口保持透明且按 Win+D 不消失。
- [ ] 勾选任务后立即进入归档列表。
- [ ] 归档列表支持任务恢复。
- [ ] 应用体积从 ~200MB 降至 ~15MB 左右。
