use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;
#[cfg(target_os = "android")]
use crate::external_paths::android_external_dir;
#[cfg(not(target_os = "android"))]
use tauri::Manager;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::prelude::*;
use tracing_subscriber::{reload, Registry};

const LOG_FILE_NAME: &str = "jm-boom.log";

static DIAGNOSTICS: OnceLock<Mutex<DiagnosticsState>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsInfo {
    pub log_dir: String,
    pub debug_logging_enabled: bool,
}

struct DiagnosticsState {
    log_dir: PathBuf,
    debug_logging_enabled: bool,
    reload_handle: reload::Handle<EnvFilter, Registry>,
    _guard: WorkerGuard,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if DIAGNOSTICS.get().is_some() {
        return Ok(());
    }

    let log_dir = diagnostics_log_dir(app)?;
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("Failed to create log directory: {error}"))?;

    let debug_logging_enabled = cfg!(debug_assertions);
    let file_appender = tracing_appender::rolling::never(&log_dir, LOG_FILE_NAME);
    let (non_blocking_writer, guard) = tracing_appender::non_blocking(file_appender);
    let (filter_layer, reload_handle) = reload::Layer::new(log_filter(debug_logging_enabled));
    let file_layer = tracing_subscriber::fmt::layer()
        .with_ansi(false)
        .with_target(true)
        .with_writer(non_blocking_writer)
        .compact();

    tracing::subscriber::set_global_default(
        tracing_subscriber::registry()
            .with(filter_layer)
            .with(file_layer),
    )
    .map_err(|error| format!("Failed to initialize tracing subscriber: {error}"))?;

    let state = DiagnosticsState {
        log_dir,
        debug_logging_enabled,
        reload_handle,
        _guard: guard,
    };
    let _ = DIAGNOSTICS.set(Mutex::new(state));
    tracing::info!("diagnostics tracing initialized");

    Ok(())
}

pub fn get_info(app: &AppHandle) -> Result<DiagnosticsInfo, String> {
    with_state(app, |state| diagnostics_info(state))
}

pub fn open_log_dir(app: &AppHandle) -> Result<(), String> {
    let info = get_info(app)?;
    tauri_plugin_opener::open_path(PathBuf::from(info.log_dir), None::<&str>).map_err(
        |open_error| {
            tracing::error!(error = %open_error, "failed to open diagnostics log directory");
            open_error.to_string()
        },
    )
}

pub fn set_debug_logging_enabled(
    app: &AppHandle,
    enabled: bool,
) -> Result<DiagnosticsInfo, String> {
    let diagnostics_info = with_state(app, |state| {
        state
            .reload_handle
            .reload(log_filter(enabled))
            .map_err(|error| format!("Failed to update tracing filter: {error}"))?;
        state.debug_logging_enabled = enabled;

        Ok::<DiagnosticsInfo, String>(diagnostics_info(state))
    })??;

    tracing::info!(
        debug_logging_enabled = enabled,
        "diagnostics debug logging changed"
    );

    Ok(diagnostics_info)
}

fn with_state<T>(
    app: &AppHandle,
    operation: impl FnOnce(&mut DiagnosticsState) -> T,
) -> Result<T, String> {
    init(app)?;
    let state = DIAGNOSTICS
        .get()
        .ok_or_else(|| "Diagnostics tracing is unavailable".to_string())?;
    let mut state = state
        .lock()
        .map_err(|_| "Diagnostics tracing state is unavailable".to_string())?;

    Ok(operation(&mut state))
}

fn diagnostics_info(state: &DiagnosticsState) -> DiagnosticsInfo {
    DiagnosticsInfo {
        log_dir: state.log_dir.to_string_lossy().to_string(),
        debug_logging_enabled: state.debug_logging_enabled,
    }
}

#[cfg(target_os = "android")]
fn diagnostics_log_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    Ok(android_external_dir("logs"))
}

#[cfg(not(target_os = "android"))]
fn diagnostics_log_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|error| format!("Failed to resolve log directory: {error}"))
}

fn log_filter(debug_logging_enabled: bool) -> EnvFilter {
    let app_level = if debug_logging_enabled {
        "debug"
    } else {
        "info"
    };

    EnvFilter::builder().parse_lossy(format!("warn,{}={app_level}", env!("CARGO_CRATE_NAME")))
}
