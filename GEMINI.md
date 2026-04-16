# 项目：我的待办事项列表 (桌面小组件)

这是一个基于 Electron、React 和 Vite 构建的轻量级、半透明、无边框桌面“小组件”风格的待办事项列表。

## 架构与技术栈
- **外壳：** Electron (v41+)
- **前端框架：** React (v19)
- **构建工具：** Vite (v8)
- **图标：** Lucide React
- **样式：** 原生 CSS 结合毛玻璃特效 (backdrop-filter)
- **数据持久化：** 存储在 Electron `userData` 目录下的 JSON 文件中。

## 项目结构
- `electron/`: 包含主进程代码 (`main.js`) 和预加载脚本 (`preload.cjs`)。
- `src/`: 包含 React 前端代码。
    - `App.jsx`: 核心应用逻辑和 UI 界面。
    - `index.css`: 全局样式及毛玻璃效果定义。
- `public/`: 静态资源文件。

## 核心功能
- **小组件 UI：** 透明无边框窗口，支持调节透明度。
- **可拖拽性：** 顶部页眉区域允许移动窗口（除非已锁定）。
- **系统托盘：** 可最小化至托盘；右键托盘查看选项，左键恢复窗口。
- **持久化：** 自动将任务和设置保存至 `todos.json` 和 `settings.json`。
- **任务管理：** 
    - 通过底部输入框添加任务。
    - 双击任务查看/编辑详情。
    - 右键点击任务弹出上下文菜单（置顶、完成、删除）。
    - 置顶任务会自动排序到列表顶部。

## 开发命令
- `npm run dev`: 同时启动 Vite 开发服务器和 Electron 应用。
- `npm run build`: 将 React 前端编译至 `dist/` 目录。
- `npm run lint`: 执行 ESLint 代码检查。
- `npm run preview`: 预览构建后的前端（仅限 Vite）。

## 开发规范
- **IPC 通信：** 使用 `window.electronAPI`（在 `preload.cjs` 中定义）进行前后端交互。
- **样式规范：** 使用 `index.css` 中 `:root` 定义的 CSS 变量来保持主题一致性。
- **状态管理：** 使用 React 本地状态，并通过 IPC `useEffect` 钩子与磁盘同步。
- **拖拽区域：** 使用 `-webkit-app-region: drag` 定义可拖拽区域，对交互元素（按钮、输入框）使用 `no-drag`。

## 生产构建
项目使用 `vite build` 生成前端资源。要打包完整的 Electron 应用，通常需要配置 `electron-builder` 或 `electron-forge`（目前 `package.json` 中尚未显式配置）。
