use windows::Win32::Foundation::{HWND, POINT, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromRect, ScreenToClient, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetParent, GetWindowLongW, GetWindowRect, SetWindowPos, GWL_STYLE, SWP_NOACTIVATE,
    SWP_NOZORDER, WS_CHILD,
};

pub fn constrain(rect: RECT, work: RECT) -> RECT {
    // Leave a small gap for the taskbar and the widget's rounded border.
    let margin = 8.min(((work.right - work.left).min(work.bottom - work.top) / 4).max(0));
    let width = (rect.right - rect.left)
        .min(work.right - work.left - 2 * margin)
        .max(1);
    let height = (rect.bottom - rect.top)
        .min(work.bottom - work.top - 2 * margin)
        .max(1);
    let left = rect.left.clamp(
        work.left + margin,
        (work.right - margin - width).max(work.left + margin),
    );
    let top = rect.top.clamp(
        work.top + margin,
        (work.bottom - margin - height).max(work.top + margin),
    );
    RECT {
        left,
        top,
        right: left + width,
        bottom: top + height,
    }
}

pub unsafe fn work_area(rect: &RECT) -> Option<RECT> {
    let monitor = MonitorFromRect(rect, MONITOR_DEFAULTTONEAREST);
    let mut info: MONITORINFO = std::mem::zeroed();
    info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
    GetMonitorInfoW(monitor, &mut info)
        .as_bool()
        .then_some(info.rcWork)
}

// GetWindowRect and monitor bounds use screen coordinates, whereas SetWindowPos
// uses parent-client coordinates for widgets attached to the Explorer desktop.
pub unsafe fn set_screen_rect(hwnd: HWND, rect: RECT) -> windows::core::Result<()> {
    let mut point = POINT {
        x: rect.left,
        y: rect.top,
    };
    if GetWindowLongW(hwnd, GWL_STYLE) as u32 & WS_CHILD.0 != 0 {
        let parent = GetParent(hwnd)?;
        if !ScreenToClient(parent, &mut point).as_bool() {
            return Err(windows::core::Error::from_win32());
        }
    }
    SetWindowPos(
        hwnd,
        HWND::default(),
        point.x,
        point.y,
        rect.right - rect.left,
        rect.bottom - rect.top,
        SWP_NOACTIVATE | SWP_NOZORDER,
    )
}

pub unsafe fn fit_window(hwnd: HWND) -> windows::core::Result<()> {
    let mut rect = RECT::default();
    GetWindowRect(hwnd, &mut rect)?;
    if let Some(work) = work_area(&rect) {
        let target = constrain(rect, work);
        if (rect.left, rect.top, rect.right, rect.bottom)
            != (target.left, target.top, target.right, target.bottom)
        {
            set_screen_rect(hwnd, target)?;
        }
    }
    Ok(())
}

pub unsafe fn resize(hwnd: HWND, width: i32, height: i32) -> windows::core::Result<()> {
    let mut old = RECT::default();
    GetWindowRect(hwnd, &mut old)?;
    let mut next = RECT {
        right: old.left + width,
        bottom: old.top + height,
        ..old
    };
    if let Some(work) = work_area(&old) {
        // Keep bottom-docked widgets docked when the height slider changes.
        if (work.bottom - old.bottom).abs() <= 16 {
            next.bottom = work.bottom - 8;
            next.top = next.bottom - height;
        }
        next = constrain(next, work);
    }
    set_screen_rect(hwnd, next)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bottom_left_growth_stays_above_taskbar() {
        let result = constrain(
            RECT {
                left: 0,
                top: 680,
                right: 350,
                bottom: 1480,
            },
            RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1040,
            },
        );
        assert_eq!((result.left, result.top, result.bottom), (8, 232, 1032));
    }
    #[test]
    fn short_negative_coordinate_monitor_limits_size() {
        let result = constrain(
            RECT {
                left: -1400,
                top: -100,
                right: -875,
                bottom: 1100,
            },
            RECT {
                left: -1280,
                top: 0,
                right: 0,
                bottom: 720,
            },
        );
        assert_eq!(
            (result.left, result.top, result.right, result.bottom),
            (-1272, 8, -747, 712)
        );
    }
}
