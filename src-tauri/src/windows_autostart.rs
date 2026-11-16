use auto_launch::AutoLaunch;
use std::{io, path::Path};
use tauri::{plugin::TauriPlugin, Manager, Runtime, State};
use winreg::{
    enums::{HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE},
    RegKey,
};

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const STARTUP_ARGS: [&str; 1] = ["--minimized"];

struct StartupEntry {
    name: String,
    executable: String,
    launcher: AutoLaunch,
}

impl StartupEntry {
    fn new(name: &str, executable: &Path) -> Self {
        // auto-launch 0.5 joins this path and its arguments without quoting it.
        let executable = format!("\"{}\"", executable.display());
        Self {
            name: name.to_owned(),
            launcher: AutoLaunch::new(name, &executable, &STARTUP_ARGS),
            executable,
        }
    }

    fn repair_existing(&self) -> io::Result<()> {
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY, KEY_QUERY_VALUE | KEY_SET_VALUE)?;
        match key.get_value::<String, _>(&self.name) {
            Ok(existing) => {
                let command = format!("{} {}", self.executable, STARTUP_ARGS.join(" "));
                if existing != command {
                    // Updating only Run preserves Task Manager's disabled state.
                    key.set_value(&self.name, &command)?;
                }
                Ok(())
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        }
    }
}

#[tauri::command]
fn enable(entry: State<'_, StartupEntry>) -> Result<(), String> {
    entry.launcher.enable().map_err(|error| error.to_string())
}

#[tauri::command]
fn disable(entry: State<'_, StartupEntry>) -> Result<(), String> {
    entry.launcher.disable().map_err(|error| error.to_string())
}

#[tauri::command]
fn is_enabled(entry: State<'_, StartupEntry>) -> Result<bool, String> {
    entry
        .launcher
        .is_enabled()
        .map_err(|error| error.to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("autostart")
        .invoke_handler(tauri::generate_handler![enable, disable, is_enabled])
        .setup(|app, _| {
            let entry = StartupEntry::new(&app.package_info().name, &std::env::current_exe()?);
            // Development builds must not replace an installed app's startup path.
            if !cfg!(debug_assertions) {
                if let Err(error) = entry.repair_existing() {
                    log::warn!("Unable to repair startup entry: {error}");
                }
            }
            app.manage(entry);
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use winreg::{enums::RegType::REG_BINARY, RegValue};

    const APPROVED_KEY: &str =
        "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
    static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

    struct TestEntry(StartupEntry);

    impl TestEntry {
        fn new() -> Self {
            let name = format!(
                "my-todo-list-startup-test-{}-{}",
                std::process::id(),
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            );
            Self(StartupEntry::new(
                &name,
                Path::new(r"C:\Program Files\我的待办\app.exe"),
            ))
        }
    }

    impl Drop for TestEntry {
        fn drop(&mut self) {
            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            for path in [RUN_KEY, APPROVED_KEY] {
                if let Ok(key) = hkcu.open_subkey_with_flags(path, KEY_SET_VALUE) {
                    let _ = key.delete_value(&self.0.name);
                }
            }
        }
    }

    #[test]
    fn enable_quotes_executable_and_keeps_arguments_outside_quotes() {
        let entry = TestEntry::new();
        entry.0.launcher.enable().unwrap();
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(RUN_KEY)
            .unwrap();
        let command: String = key.get_value(&entry.0.name).unwrap();
        assert_eq!(
            command,
            "\"C:\\Program Files\\我的待办\\app.exe\" --minimized"
        );
        assert!(entry.0.launcher.is_enabled().unwrap());
        entry.0.launcher.disable().unwrap();
        assert!(!entry.0.launcher.is_enabled().unwrap());
    }

    #[test]
    fn repair_updates_old_path_and_preserves_disabled_state() {
        let entry = TestEntry::new();
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (run, _) = hkcu.create_subkey(RUN_KEY).unwrap();
        let (approved, _) = hkcu.create_subkey(APPROVED_KEY).unwrap();
        run.set_value(&entry.0.name, &r"C:\Old Install\app.exe --minimized")
            .unwrap();
        let disabled = RegValue {
            vtype: REG_BINARY,
            bytes: vec![3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        };
        approved.set_raw_value(&entry.0.name, &disabled).unwrap();

        entry.0.repair_existing().unwrap();

        let command: String = run.get_value(&entry.0.name).unwrap();
        assert_eq!(
            command,
            "\"C:\\Program Files\\我的待办\\app.exe\" --minimized"
        );
        assert_eq!(
            approved.get_raw_value(&entry.0.name).unwrap().bytes,
            disabled.bytes
        );
        assert!(!entry.0.launcher.is_enabled().unwrap());
    }

    #[test]
    fn repair_does_not_create_a_missing_entry() {
        let entry = TestEntry::new();
        entry.0.repair_existing().unwrap();
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(RUN_KEY)
            .unwrap();
        assert_eq!(
            key.get_value::<String, _>(&entry.0.name)
                .unwrap_err()
                .kind(),
            io::ErrorKind::NotFound
        );
    }
}
