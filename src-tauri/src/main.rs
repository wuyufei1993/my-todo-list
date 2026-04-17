// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;

use models::{BackupData, Settings, Task};
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::{
    menu::{Menu, MenuItem},
    path::BaseDirectory,
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_dialog::DialogExt;

#[cfg(target_os = "windows")]
use windows::core::w;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetWindowLongW, SendMessageTimeoutW,
    SetParent, SetWindowLongW, SetWindowPos, GWL_STYLE, HWND_NOTOPMOST, HWND_TOPMOST, SMTO_NORMAL,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WS_CAPTION, WS_CHILD,
    WS_CLIPSIBLINGS, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

/// 窗口子类回调：拦截样式变更和非客户区绘制，防止 Win+D 等系统操作重新添加窗口边框和标题栏
#[cfg(target_os = "windows")]
const WM_STYLECHANGING: u32 = 0x007C;
#[cfg(target_os = "windows")]
const WM_STYLECHANGED: u32 = 0x007D;
#[cfg(target_os = "windows")]
const WM_NCCALCSIZE: u32 = 0x0083;
#[cfg(target_os = "windows")]
const WM_NCPAINT: u32 = 0x0085;
#[cfg(target_os = "windows")]
const WM_NCACTIVATE: u32 = 0x0086;
#[cfg(target_os = "windows")]
const WM_MOVING: u32 = 0x0216;

#[cfg(target_os = "windows")]
const DECORATION_GUARD_ID: usize = 1;
#[cfg(target_os = "windows")]
const EDGE_CLAMP_ID: usize = 2;

#[cfg(target_os = "windows")]
#[repr(C)]
struct StyleStruct {
    _style_old: u32,
    style_new: u32,
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn decoration_guard_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _uid_subclass: usize,
    _dw_ref_data: usize,
) -> LRESULT {
    match msg {
        WM_STYLECHANGING => {
            let ss = &mut *(lparam.0 as *mut StyleStruct);
            if wparam.0 as i32 == GWL_STYLE.0 {
                // 剥离所有装饰样式位，保持无边框
                ss.style_new &= !(WS_CAPTION.0
                    | WS_THICKFRAME.0
                    | WS_SYSMENU.0
                    | WS_MAXIMIZEBOX.0
                    | WS_MINIMIZEBOX.0);
            } else if wparam.0 as i32 == windows::Win32::UI::WindowsAndMessaging::GWL_EXSTYLE.0 {
                // 剥离扩展边框样式
                ss.style_new &= !(windows::Win32::UI::WindowsAndMessaging::WS_EX_WINDOWEDGE.0
                    | windows::Win32::UI::WindowsAndMessaging::WS_EX_CLIENTEDGE.0
                    | windows::Win32::UI::WindowsAndMessaging::WS_EX_STATICEDGE.0
                    | windows::Win32::UI::WindowsAndMessaging::WS_EX_DLGMODALFRAME.0);
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_STYLECHANGED => {
            // 样式已被修改后的补救：强制再次剥离装饰位
            if wparam.0 as i32 == GWL_STYLE.0 {
                let current = GetWindowLongW(hwnd, GWL_STYLE) as u32;
                let stripped = current
                    & !(WS_CAPTION.0
                        | WS_THICKFRAME.0
                        | WS_SYSMENU.0
                        | WS_MAXIMIZEBOX.0
                        | WS_MINIMIZEBOX.0);
                if stripped != current {
                    SetWindowLongW(hwnd, GWL_STYLE, stripped as i32);
                }
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_NCCALCSIZE => {
            // 彻底消除标题栏和非客户区空间
            return LRESULT(0);
        }
        WM_NCPAINT => {
            // 跳过所有非客户区绘制，防止标题栏被画出来
            return LRESULT(0);
        }
        WM_NCACTIVATE => {
            // 阻止激活/失焦时的非客户区重绘（标题栏闪现的直接原因）
            return LRESULT(1);
        }
        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}

/// 窗口子类回调：在窗口移动前拦截 WM_MOVING，将目标位置限制在屏幕工作区内，消除拖拽到边缘时的闪烁
#[cfg(target_os = "windows")]
unsafe extern "system" fn edge_clamp_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _uid_subclass: usize,
    _dw_ref_data: usize,
) -> LRESULT {
    if msg == WM_MOVING {
        use windows::Win32::Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        };

        let rect = &mut *(lparam.0 as *mut windows::Win32::Foundation::RECT);
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;

        if GetMonitorInfoW(monitor, &mut mi as *mut _).as_bool() {
            let work = mi.rcWork;
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;

            if rect.left < work.left {
                rect.left = work.left;
                rect.right = work.left + w;
            }
            if rect.top < work.top {
                rect.top = work.top;
                rect.bottom = work.top + h;
            }
            if rect.right > work.right {
                rect.right = work.right;
                rect.left = work.right - w;
            }
            if rect.bottom > work.bottom {
                rect.bottom = work.bottom;
                rect.top = work.bottom - h;
            }
        }
        return LRESULT(1);
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn find_desktop_worker_window() -> Option<HWND> {
    // Force Progman to create WorkerW if it hasn't already
    unsafe {
        if let Ok(progman) = FindWindowW(w!("Progman"), None) {
            let _ = SendMessageTimeoutW(
                progman,
                0x052C,
                windows::Win32::Foundation::WPARAM(0),
                LPARAM(0),
                SMTO_NORMAL,
                1000,
                None,
            );
        }
    }

    struct State {
        worker: Option<HWND>,
    }
    let mut state = State { worker: None };

    unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam.0 as *mut State);

        let mut class_name = [0u16; 256];
        GetClassNameW(hwnd, &mut class_name);

        let class_name_str = String::from_utf16_lossy(&class_name);
        let class_name_str = class_name_str.trim_end_matches('\0');

        if class_name_str != "Progman" && class_name_str != "WorkerW" {
            // if class_name_str != "Progman" { return BOOL(1); }
            return BOOL(1);
        }

        let def_view = FindWindowExW(hwnd, None, w!("SHELLDLL_DefView"), None);
        if def_view.is_ok() {
            if class_name_str == "WorkerW" {
                state.worker = Some(hwnd);
                println!("find_desktop_worker_window selected WorkerW from EnumWindows");
            } else {
                state.worker = Some(hwnd);
                println!("find_desktop_worker_window selected Progman from EnumWindows");
            }
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(
            Some(enum_windows_callback),
            LPARAM(&mut state as *mut State as isize),
        );
    }

    if state.worker.is_none() {
        println!("attach aborted: no worker window");
    }

    state.worker
}

fn get_file_path(app_handle: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let mut path = app_handle
        .path()
        .resolve("", BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    path.push(filename);
    Ok(path)
}

#[tauri::command]
async fn export_data(app_handle: AppHandle) -> Result<String, String> {
    let tasks = get_tasks(app_handle.clone())?;

    // Get all archive
    let archive_path = get_file_path(&app_handle, "archive.json")?;
    let archive = if archive_path.exists() {
        let content = fs::read_to_string(archive_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_else(|_| Vec::new())
    } else {
        Vec::new()
    };

    let settings = get_settings(app_handle.clone())?;

    let backup = BackupData {
        tasks,
        archive,
        settings,
        version: "1.0.0".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as i64,
    };

    let json = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;

    let file_path = app_handle
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name("todo_backup.json")
        .blocking_save_file();

    if let Some(path) = file_path {
        let path = path.into_path().map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
        Ok("导出成功".to_string())
    } else {
        Err("取消导出".to_string())
    }
}

#[tauri::command]
async fn import_data(app_handle: AppHandle) -> Result<String, String> {
    let file_path = app_handle
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let path = path.into_path().map_err(|e| e.to_string())?;
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let backup: BackupData =
            serde_json::from_str(&content).map_err(|e| format!("无效的备份文件: {}", e))?;

        // Save to local storage
        save_tasks(app_handle.clone(), backup.tasks)?;

        let archive_path = get_file_path(&app_handle, "archive.json")?;
        let archive_content = serde_json::to_string(&backup.archive).map_err(|e| e.to_string())?;
        fs::write(archive_path, archive_content).map_err(|e| e.to_string())?;

        save_settings(app_handle.clone(), backup.settings)?;

        Ok("导入成功，请重启应用以应用所有设置".to_string())
    } else {
        Err("取消导入".to_string())
    }
}

#[tauri::command]
fn get_tasks(app_handle: AppHandle) -> Result<Vec<Task>, String> {
    let path = get_file_path(&app_handle, "todos.json")?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let tasks: Vec<Task> = serde_json::from_str(&content).unwrap_or_else(|_| Vec::new());
    Ok(tasks)
}

#[tauri::command]
fn save_tasks(app_handle: AppHandle, tasks: Vec<Task>) -> Result<(), String> {
    let path = get_file_path(&app_handle, "todos.json")?;
    let content = serde_json::to_string(&tasks).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_archive(app_handle: AppHandle, offset_months: u32) -> Result<Vec<Task>, String> {
    let path = get_file_path(&app_handle, "archive.json")?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let all_tasks: Vec<Task> = serde_json::from_str(&content).unwrap_or_else(|_| Vec::new());

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let ms_per_month: i64 = 30 * 24 * 60 * 60 * 1000;

    let start_threshold = now - (offset_months as i64 * ms_per_month);
    let end_threshold = now - ((offset_months as i64 + 3) * ms_per_month);

    let filtered = all_tasks
        .into_iter()
        .filter(|t| t.timestamp < start_threshold && t.timestamp >= end_threshold)
        .collect();
    Ok(filtered)
}

#[tauri::command]
fn get_settings(app_handle: AppHandle) -> Result<Settings, String> {
    let path = get_file_path(&app_handle, "settings.json")?;
    if !path.exists() {
        return Ok(Settings {
            opacity: 1.0,
            font_size: 14,
            always_on_top: false,
            height: 500,
            x: None,
            y: None,
        });
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&content).unwrap_or_else(|_| Settings {
        opacity: 1.0,
        font_size: 14,
        always_on_top: false,
        height: 500,
        x: None,
        y: None,
    });
    Ok(settings)
}

#[tauri::command]
fn save_settings(app_handle: AppHandle, settings: Settings) -> Result<(), String> {
    let path = get_file_path(&app_handle, "settings.json")?;
    let content = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn archive_tasks(app_handle: AppHandle, tasks_to_archive: Vec<Task>) -> Result<(), String> {
    let path = get_file_path(&app_handle, "archive.json")?;
    let mut all_archive = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_else(|_| Vec::new())
    } else {
        Vec::new()
    };

    all_archive.extend(tasks_to_archive);
    let content = serde_json::to_string(&all_archive).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_always_on_top<R: Runtime>(
    window: tauri::WebviewWindow<R>,
    always_on_top: bool,
) -> Result<(), String> {
    apply_always_on_top(&window, always_on_top);
    Ok(())
}

fn apply_always_on_top<R: Runtime>(window: &tauri::WebviewWindow<R>, always_on_top: bool) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = HWND(hwnd.0 as _);
            unsafe {
                let mut style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
                if always_on_top {
                    // 移除装饰守护子类（如果之前安装过）
                    let _ = RemoveWindowSubclass(
                        hwnd,
                        Some(decoration_guard_proc),
                        DECORATION_GUARD_ID,
                    );
                    let _ = SetParent(hwnd, HWND::default());
                    // 恢复原本的弹出窗样式位
                    style = (style & !WS_CHILD.0) | WS_POPUP.0;
                    SetWindowLongW(hwnd, GWL_STYLE, style as i32);
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE,
                    );
                } else {
                    if let Some(worker) = find_desktop_worker_window() {
                        // 1. 设置为子窗口
                        style = (style & !WS_POPUP.0) | WS_CHILD.0 | WS_CLIPSIBLINGS.0;
                        // 2. 彻底剥离任何标题栏、边框和系统按钮 (防止 Win+D 恢复它们)
                        style &= !(WS_CAPTION.0
                            | WS_THICKFRAME.0
                            | WS_SYSMENU.0
                            | WS_MAXIMIZEBOX.0
                            | WS_MINIMIZEBOX.0);

                        SetWindowLongW(hwnd, GWL_STYLE, style as i32);
                        let _ = SetParent(hwnd, worker);
                        // 安装窗口子类，拦截 WM_STYLECHANGING 防止系统重新添加边框
                        let _ = SetWindowSubclass(
                            hwnd,
                            Some(decoration_guard_proc),
                            DECORATION_GUARD_ID,
                            0,
                        );
                    }
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_NOTOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE,
                    );
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = window.set_always_on_top(always_on_top);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            save_tasks,
            get_archive,
            get_settings,
            save_settings,
            archive_tasks,
            update_always_on_top,
            export_data,
            import_data
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let handle = app.handle().clone();

            // 1. 加载设置并恢复位置/置顶状态
            let mut settings_loaded = false;
            if let Ok(path) = get_file_path(&handle, "settings.json") {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(settings) = serde_json::from_str::<Settings>(&content) {
                        apply_always_on_top(&window, settings.always_on_top);
                        if let (Some(x), Some(y)) = (settings.x, settings.y) {
                            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                        } else {
                            // 初始定位到右下角
                            if let Ok(Some(monitor)) = window.current_monitor() {
                                let area = monitor.work_area();
                                let win_size = window.outer_size().unwrap_or_default();
                                let x = area.position.x + area.size.width as i32
                                    - win_size.width as i32;
                                let y = area.position.y + area.size.height as i32
                                    - win_size.height as i32;
                                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                            }
                        }
                        settings_loaded = true;
                    }
                }
            }

            if !settings_loaded {
                apply_always_on_top(&window, true);
                // 默认初始定位
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let area = monitor.work_area();
                    let win_size = window.outer_size().unwrap_or_default();
                    let x = area.position.x + area.size.width as i32 - win_size.width as i32;
                    let y = area.position.y + area.size.height as i32 - win_size.height as i32;
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }

            // 安装边界限制子类：在窗口移动前拦截 WM_MOVING，限制在工作区内，消除闪烁
            #[cfg(target_os = "windows")]
            {
                if let Ok(hwnd) = window.hwnd() {
                    let hwnd = HWND(hwnd.0 as _);
                    unsafe {
                        let _ = SetWindowSubclass(hwnd, Some(edge_clamp_proc), EDGE_CLAMP_ID, 0);
                    }
                }
            }

            // Auto-save position on move
            let app_handle_for_event = handle.clone();
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::Moved(pos) => {
                        // 位置已由 WM_MOVING 子类限制在屏幕工作区内，直接保存
                        if let Ok(path) = get_file_path(&app_handle_for_event, "settings.json") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                if let Ok(mut settings) = serde_json::from_str::<Settings>(&content)
                                {
                                    settings.x = Some(pos.x);
                                    settings.y = Some(pos.y);
                                    let _ = fs::write(
                                        path,
                                        serde_json::to_string(&settings).unwrap_or_default(),
                                    );
                                }
                            }
                        }
                    }
                    // 无边框样式由窗口子类 (WM_STYLECHANGING) 守护，不再需要在事件中处理
                    _ => {}
                }
            });

            // Create Tray Menu with AppHandle
            let handle = app.handle();
            let show_i = MenuItem::with_id(handle, "show", "显示小组件", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(handle, "hide", "隐藏到托盘", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(handle, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(handle, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
