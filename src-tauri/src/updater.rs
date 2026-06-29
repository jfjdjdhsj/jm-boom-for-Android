use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateCheckResult {
    pub current_version: String,
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<AppUpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    let updater = app
        .updater_builder()
        .build()
        .map_err(|error| format!("初始化更新器失败: {error}"))?;

    let update = updater
        .check()
        .await
        .map_err(|error| format!("检查更新失败: {error}"))?;

    Ok(match update {
        Some(update) => AppUpdateCheckResult {
            current_version,
            available: true,
            version: Some(update.version),
            notes: update.body,
            pub_date: update.date.map(|date| date.to_string()),
        },
        None => AppUpdateCheckResult {
            current_version,
            available: false,
            version: None,
            notes: None,
            pub_date: None,
        },
    })
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<bool, String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|error| format!("初始化更新器失败: {error}"))?;

    let Some(update) = updater
        .check()
        .await
        .map_err(|error| format!("检查更新失败: {error}"))?
    else {
        return Ok(false);
    };

    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| format!("下载更新失败: {error}"))?;

    update
        .install(bytes)
        .map_err(|error| format!("安装更新失败: {error}"))?;

    #[cfg(not(target_os = "windows"))]
    app.restart();

    Ok(true)
}
