# My Todo List (Desktop Widget)

[简体中文](README.md) | **English**

A lightweight, translucent, frameless desktop todo widget built with **Tauri v2**, **React 19**, and **Vite 8**. It provides a simple, unobtrusive interface for managing everyday tasks.

## ✨ Features

- **Desktop widget:** A frameless design with a frosted-glass effect (Backdrop Filter) that blends into your desktop.
- **Customization:** Adjust opacity, font size, and window height in real time.
- **Window controls:**
    - **Move and lock:** Drag the header to move the widget, or lock its position.
    - **Screen boundaries:** Keep the window within the screen's work area while moving it.
    - **System tray:** Hide the widget in the system tray, right-click for quick actions, or left-click to restore it.
- **Task management:**
    - **Quick entry:** Add tasks using the input at the bottom.
    - **Details and deadlines:** Double-click a task to edit its description and due date.
    - **Drag to reorder:** Hover over a task and drag its handle to change the order, which is saved automatically. Pinned and unpinned tasks can be reordered within their own groups. Drag near the top or bottom of the list to scroll automatically; press Esc or release outside the list to cancel. Automatic sorting applies until you reorder tasks manually. Newly added or restored tasks appear before manually ordered tasks in their group.
    - **Due-date indicators:** Colors distinguish overdue, urgent, and upcoming tasks.
    - **Pin and archive:** Use the context menu to pin, complete and archive, or delete a task.
- **Local storage:** Tasks and settings are saved automatically as JSON files in the system's `AppData` directory.

## 🛠️ Technology

- **Desktop shell:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** [React 19](https://react.dev/) (Vite 8)
- **UI icons:** [Lucide React](https://lucide.dev/)
- **App icon:** A custom checklist and checkmark design. Its source is `public/favicon.svg`; desktop and tray assets are in `src-tauri/icons/`.
- **Styling:** Plain CSS with CSS variables

## 🚀 Getting Started

### Prerequisites

Install the following on your computer:

1. [Node.js](https://nodejs.org/) (LTS recommended)
2. [Rust toolchain](https://www.rust-lang.org/tools/install)
3. Tauri dependencies for your operating system (see the [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites))

### Install and Run

1. Clone the repository:

   ```bash
   git clone https://github.com/wuyufei1993/my-todo-list.git
   cd my-todo-list
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development mode:

   ```bash
   npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   ```

## Layout and Boundary Checks

- On Windows, changing the widget's height, restoring its position, or toggling always-on-top keeps it within the screen's work area, with a margin above the taskbar. Resizing a widget placed at the bottom preserves its bottom position.
- Context menus and task tooltips flip to fit the available window space. Settings and task detail dialogs scroll independently while keeping their action buttons visible.
- Run `npm test` for regression checks, `npm run lint` for frontend code checks, and `npm run build:frontend` to verify the frontend build.
- Native Windows boundary tests are in `src-tauri/src/window_layout.rs`. After installing Rust and the Windows build dependencies, run `cargo test --manifest-path src-tauri/Cargo.toml`.
- Regenerate icons with `npm run tauri -- icon public/favicon.svg --output src-tauri/icons` (this also generates mobile platform icons).

## 📂 Project Structure

- `src-tauri/`: Rust backend for IPC, system tray management, local storage, and window behavior.
- `src/`: React frontend with UI components and application logic.
- `public/`: Static assets, including icons and SVG files.

## 📝 License

[MIT License](LICENSE)
