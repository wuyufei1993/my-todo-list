# 我的待办事项列表 (桌面小组件)

这是一个基于 **Tauri v2**、**React 19** 和 **Vite 8** 构建的轻量级、半透明、无边框桌面“小组件”风格的待办事项列表。它旨在提供一个简洁且不干扰工作的界面，帮助您高效管理日常任务。

## ✨ 核心特性

- **小组件体验：** 采用无边框设计，支持毛玻璃特效（Backdrop Filter），完美融入桌面环境。
- **高度自定义：** 支持实时调节透明度、字体大小以及窗口高度。
- **智能交互：**
    - **自由拖拽：** 顶部页眉区域可自由移动窗口（支持锁定位置）。
    - **自动吸附：** 窗口在移动时会自动吸附并限制在屏幕工作区内，防止超出边界。
    - **系统托盘：** 支持最小化至系统托盘，右键查看快捷选项，左键快速恢复。
- **任务管理：**
    - **快速添加：** 底部输入框即用即加。
    - **详情编辑：** 双击任务进入详情模态框，支持编辑描述和设置截止日期。
    - **拖拽排序：** 鼠标移入待办项后，拖动操作区的拖拽手柄调整顺序并自动保存；置顶项和普通项分别排序，靠近列表上下边缘可自动滚动，按 Esc 或移出列表松手可取消。未手动排序时沿用自动排序，新增或恢复的任务排在所属分组的手动排序项之前。
    - **状态预警：** 根据截止日期自动通过颜色区分状态（过期、紧急、近期）。
    - **置顶与归档：** 右键菜单支持任务置顶、完成归档或直接删除。
- **数据持久化：** 数据自动保存至系统 `AppData` 目录下的 JSON 文件中，确保数据安全不丢失。

## 🛠️ 技术栈

- **外壳：** [Tauri v2](https://tauri.app/) (Rust)
- **前端：** [React 19](https://react.dev/) (Vite 8)
- **图标：** [Lucide React](https://lucide.dev/)
- **应用图标：** 自有的清单与完成勾图标，源文件为 `public/favicon.svg`，桌面与托盘资源位于 `src-tauri/icons/`。
- **样式：** 原生 CSS (CSS Variables)

## 🚀 快速开始

### 开发环境准备

确保您的电脑已安装：
1. [Node.js](https://nodejs.org/) (推荐 LTS 版本)
2. [Rust 编译环境](https://www.rust-lang.org/tools/install)
3. 对应操作系统的 Tauri 依赖（参考 [Tauri 官方文档](https://tauri.app/v1/guides/getting-started/prerequisites)）

### 安装与运行

1. 克隆项目：
   ```bash
   git clone <repository-url>
   cd my-todo-list
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发模式：
   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

## 布局与边界检查

- Windows 小组件在调节高度、恢复位置及切换置顶时，会限制在屏幕工作区内，并为任务栏留出边距。贴底放置时，修改高度会保留底部位置。
- 右键菜单和详情提示根据窗口剩余空间翻转；设置和详情弹窗的内容可独立滚动，操作按钮始终保留。
- `npm test` 运行回归检查，`npm run lint` 检查前端代码，`npm run build:frontend` 验证前端构建。
- Windows 原生边界测试位于 `src-tauri/src/window_layout.rs`，在安装 Rust 与 Windows 构建依赖后运行 `cargo test --manifest-path src-tauri/Cargo.toml`。
- 图标可通过 `npm run tauri -- icon public/favicon.svg --output src-tauri/icons` 重新生成（该工具也会输出移动平台图标）。

## 📂 项目结构

- `src-tauri/`: Rust 后端代码，负责 IPC 通信、托盘管理、文件持久化和窗口逻辑。
- `src/`: React 前端代码，包含 UI 组件和业务逻辑。
- `public/`: 静态资源文件（图标、SVG 等）。

## 📝 许可证

[MIT License](LICENSE)
