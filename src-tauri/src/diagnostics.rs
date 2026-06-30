use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const LOG_FILE_NAME: &str = "jm-boom.log";
const MAX_LOG_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_ROTATED_LOG_FILES: usize = 2;

static DIAGNOSTICS: OnceLock<Mutex<DiagnosticsState>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsInfo {
    pub log_dir: String,
    pub debug_logging_enabled: bool,
    pub max_log_file_bytes: u64,
    pub max_log_file_count: usize,
}

#[derive(Debug)]
struct DiagnosticsState {
    log_dir: PathBuf,
    debug_logging_enabled: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        }
    }
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if DIAGNOSTICS.get().is_some() {
        return Ok(());
    }

    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("Failed to resolve log directory: {error}"))?;
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("Failed to create log directory: {error}"))?;

    let state = DiagnosticsState {
        log_dir,
        debug_logging_enabled: cfg!(debug_assertions),
    };
    let _ = DIAGNOSTICS.set(Mutex::new(state));
    info("Diagnostics logging initialized");

    Ok(())
}

pub fn get_info(app: &AppHandle) -> Result<DiagnosticsInfo, String> {
    with_state(app, |state| diagnostics_info(state))
}

pub fn open_log_dir(app: &AppHandle) -> Result<(), String> {
    let info = get_info(app)?;
    tauri_plugin_opener::open_path(PathBuf::from(info.log_dir), None::<&str>).map_err(
        |open_error| {
            error(format!(
                "Failed to open diagnostics log directory: {open_error}"
            ));
            open_error.to_string()
        },
    )
}

pub fn set_debug_logging_enabled(
    app: &AppHandle,
    enabled: bool,
) -> Result<DiagnosticsInfo, String> {
    let diagnostics_info = with_state(app, |state| {
        state.debug_logging_enabled = enabled;
        diagnostics_info(state)
    })?;

    info(format!(
        "Diagnostics debug logging {}",
        if enabled { "enabled" } else { "disabled" }
    ));

    Ok(diagnostics_info)
}

pub fn debug(message: impl Into<String>) {
    write_log(LogLevel::Debug, message.into());
}

pub fn info(message: impl Into<String>) {
    write_log(LogLevel::Info, message.into());
}

pub fn warn(message: impl Into<String>) {
    write_log(LogLevel::Warn, message.into());
}

pub fn error(message: impl Into<String>) {
    write_log(LogLevel::Error, message.into());
}

fn with_state<T>(
    app: &AppHandle,
    operation: impl FnOnce(&mut DiagnosticsState) -> T,
) -> Result<T, String> {
    init(app)?;
    let state = DIAGNOSTICS
        .get()
        .ok_or_else(|| "Diagnostics logging is unavailable".to_string())?;
    let mut state = state
        .lock()
        .map_err(|_| "Diagnostics logging state is unavailable".to_string())?;

    Ok(operation(&mut state))
}

fn diagnostics_info(state: &DiagnosticsState) -> DiagnosticsInfo {
    DiagnosticsInfo {
        log_dir: state.log_dir.to_string_lossy().to_string(),
        debug_logging_enabled: state.debug_logging_enabled,
        max_log_file_bytes: MAX_LOG_FILE_BYTES,
        max_log_file_count: MAX_ROTATED_LOG_FILES + 1,
    }
}

fn write_log(level: LogLevel, message: String) {
    let Some(state) = DIAGNOSTICS.get() else {
        return;
    };
    let Ok(state) = state.lock() else {
        return;
    };

    if level == LogLevel::Debug && !state.debug_logging_enabled {
        return;
    }

    let message = sanitize_log_message(&message);
    let line = format!(
        "[{}] {:<5} {}\n",
        unix_timestamp_ms(),
        level.as_str(),
        message
    );
    let _ = write_log_line(&state, line.as_bytes());
}

fn write_log_line(state: &DiagnosticsState, line: &[u8]) -> Result<(), std::io::Error> {
    fs::create_dir_all(&state.log_dir)?;
    rotate_logs_if_needed(&state.log_dir)?;
    let log_path = state.log_dir.join(LOG_FILE_NAME);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;

    file.write_all(line)
}

fn rotate_logs_if_needed(log_dir: &Path) -> Result<(), std::io::Error> {
    let current_path = log_dir.join(LOG_FILE_NAME);
    let Ok(metadata) = fs::metadata(&current_path) else {
        return Ok(());
    };

    if metadata.len() < MAX_LOG_FILE_BYTES {
        return Ok(());
    }

    for index in (1..=MAX_ROTATED_LOG_FILES).rev() {
        let source_path = if index == 1 {
            current_path.clone()
        } else {
            rotated_log_path(log_dir, index - 1)
        };
        let target_path = rotated_log_path(log_dir, index);

        if source_path.exists() {
            let _ = fs::remove_file(&target_path);
            fs::rename(source_path, target_path)?;
        }
    }

    Ok(())
}

fn rotated_log_path(log_dir: &Path, index: usize) -> PathBuf {
    log_dir.join(format!("jm-boom.{index}.log"))
}

fn sanitize_log_message(message: &str) -> String {
    message
        .chars()
        .map(|character| match character {
            '\r' | '\n' => ' ',
            _ => character,
        })
        .collect()
}

fn unix_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}
