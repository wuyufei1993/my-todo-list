// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;

use models::{Settings, Task};
use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    path::BaseDirectory,
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetParent, SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST, SWP_FRAMECHANGED,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE,
};

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
        });
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&content).unwrap_or_else(|_| Settings {
        opacity: 1.0,
        font_size: 14,
        always_on_top: false,
        height: 500,
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
fn update_always_on_top<R: Runtime>(window: tauri::WebviewWindow<R>, always_on_top: bool) -> Result<(), String> {
    apply_always_on_top(&window, always_on_top);
    Ok(())
}

fn apply_always_on_top<R: Runtime>(window: &tauri::WebviewWindow<R>, always_on_top: bool) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = HWND(hwnd.0 as _);
            unsafe {
                let is_desktop_attached = GetParent(hwnd)
                    .map(|p| !p.0.is_null())
                    .unwrap_or(false);
                if !is_desktop_attached {
                    let order = if always_on_top { HWND_TOPMOST } else { HWND_NOTOPMOST };
                    let _ = SetWindowPos(
                        hwnd,
                        order,
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
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            save_tasks,
            get_archive,
            get_settings,
            save_settings,
            archive_tasks,
            update_always_on_top
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Try initial load for always_on_top
            if let Ok(path) = get_file_path(app.handle(), "settings.json") {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(settings) = serde_json::from_str::<Settings>(&content) {
                        apply_always_on_top(&window, settings.always_on_top);
                    } else {
                        apply_always_on_top(&window, true);
                    }
                } else {
                    apply_always_on_top(&window, true);
                }
            } else {
                apply_always_on_top(&window, true);
            }

            // Desktop edge snapping logic
            let window_handle = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Moved(pos) = event {
                    let win = window_handle.clone();
                    if let Ok(Some(monitor)) = win.current_monitor() {
                        let area = monitor.work_area();
                        let size = win.inner_size().unwrap_or_default();
                        let mut new_x = pos.x;
                        let mut new_y = pos.y;
                        let edge_correction = 0; // 由于 CSS margin 已移除，先回归 0 观察基准
                        let mut should_reposition = false;

                        // 强制限制逻辑（禁止超出屏幕，使用基准 0 偏移）
                        let min_x = area.position.x - edge_correction;
                        let max_x = area.position.x + area.size.width as i32 + edge_correction - size.width as i32;
                        let min_y = area.position.y - edge_correction;
                        let max_y = area.position.y + area.size.height as i32 + edge_correction - size.height as i32;

                        if new_x < min_x { new_x = min_x; should_reposition = true; }
                        if new_x > max_x { new_x = max_x; should_reposition = true; }
                        if new_y < min_y { new_y = min_y; should_reposition = true; }
                        if new_y > max_y { new_y = max_y; should_reposition = true; }

                        if should_reposition && (new_x != pos.x || new_y != pos.y) {
                            let _ = win.set_position(tauri::PhysicalPosition::new(new_x, new_y));
                        }
                    }
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
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
