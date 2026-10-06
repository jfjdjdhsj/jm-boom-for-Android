#[cfg(not(target_os = "android"))]
use crate::api::{self, ApiError, ApiResult};
use crate::api::{ApiErrorDto, ApiErrorKind};
#[cfg(not(target_os = "android"))]
use crate::storage::runtime_cache;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use std::io::Write;
#[cfg(target_os = "android")]
use std::path::Path;
#[cfg(target_os = "android")]
use std::sync::Mutex;
use std::time::Duration;
#[cfg(target_os = "android")]
use std::time::Instant;
use tauri::AppHandle;
#[cfg(target_os = "android")]
use tauri::Emitter;
#[cfg(target_os = "android")]
use tauri::Manager;
use tauri::Runtime;
#[cfg(target_os = "android")]
use tauri::Wry;
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;
#[cfg(not(target_os = "android"))]
use tauri_plugin_updater::Updater;
#[cfg(not(target_os = "android"))]
use tauri_plugin_updater::UpdaterExt;
#[cfg(not(target_os = "android"))]
use url::Url;

#[cfg(not(target_os = "android"))]
const APP_UPDATE_CACHE_KIND: &str = "app_update_check";
#[cfg(not(target_os = "android"))]
const APP_UPDATE_CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
#[cfg(target_os = "android")]
const ANDROID_RELEASE_API_URL: &str =
    "https://api.github.com/repos/jfjdjdhsj/jm-boom-for-Android/releases/latest";
#[cfg(target_os = "android")]
const ANDROID_RELEASE_PAGE_URL: &str =
    "https://github.com/jfjdjdhsj/jm-boom-for-Android/releases/latest";
#[cfg(target_os = "android")]
const ANDROID_UPDATE_CACHE_TTL: Duration = Duration::from_secs(6 * 60 * 60);
#[cfg(target_os = "android")]
const RELEASE_TAG_MARKER: &str = "/releases/tag/";
#[cfg(target_os = "android")]
const ANDROID_PLUGIN_IDENTIFIER: &str = "com.ppxb.jmboom";
#[cfg(target_os = "android")]
const ANDROID_PLUGIN_CLASS: &str = "UpdateInstaller";
#[cfg(target_os = "android")]
const ANDROID_UPDATE_PROGRESS_EVENT: &str = "app-update-download-progress";
#[cfg(target_os = "android")]
const ANDROID_APK_URL_TEMPLATE: &str =
    "https://github.com/jfjdjdhsj/jm-boom-for-Android/releases/download/{tag}/JM-Boom-{abi}-{tag}.apk";
#[cfg(target_os = "android")]
const ANDROID_DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(10 * 60);

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateCheckResult {
    pub current_version: String,
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub manual_install_url: Option<String>,
}

/// 应用内下载更新时的进度事件负载。
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

/// 应用内下载完成后的结果。
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDownloadResult {
    pub version: String,
    pub path: String,
}

type UpdateCommandResult<T> = Result<T, ApiErrorDto>;

/// 注册 Android 安装插件。桌面端注册为空插件，保持命令名一致。
pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("jm-boom-updater")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    _api.register_android_plugin(ANDROID_PLUGIN_IDENTIFIER, ANDROID_PLUGIN_CLASS)?;
                _app.manage(UpdateInstaller::<R> { handle });
            }
            Ok(())
        })
        .build()
}

/// Android 侧安装插件句柄。
#[cfg(target_os = "android")]
pub struct UpdateInstaller<R: Runtime> {
    handle: PluginHandle<R>,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct AndroidUpdateDirResponse {
    dir: String,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct AndroidInstallResponse {
    #[allow(dead_code)]
    ok: bool,
}

#[tauri::command]
#[cfg(not(target_os = "android"))]
pub async fn check_app_update(
    app: AppHandle,
    force: Option<bool>,
) -> UpdateCommandResult<AppUpdateCheckResult> {
    let current_version = app.package_info().version.to_string();
    let cache_key = app_update_cache_key(&current_version);

    if !force.unwrap_or(false) {
        if let Some(cached) = runtime_cache_get::<AppUpdateCheckResult>(&cache_key).await {
            return Ok(cached);
        }
    }

    let updater = build_updater(&app).map_err(ApiErrorDto::from)?;

    let update = updater.check().await.map_err(|error| {
        ApiErrorDto::new(ApiErrorKind::Network, format!("检查更新失败: {error}"))
    })?;

    let result = match update {
        Some(update) => AppUpdateCheckResult {
            current_version,
            available: true,
            version: Some(update.version),
            notes: update.body,
            pub_date: update.date.map(|date| date.to_string()),
            manual_install_url: None,
        },
        None => AppUpdateCheckResult {
            current_version,
            available: false,
            version: None,
            notes: None,
            pub_date: None,
            manual_install_url: None,
        },
    };

    runtime_cache_set(&cache_key, &result, APP_UPDATE_CACHE_TTL).await;

    Ok(result)
}

#[tauri::command]
#[cfg(target_os = "android")]
pub async fn check_app_update(
    app: AppHandle,
    force: Option<bool>,
) -> UpdateCommandResult<AppUpdateCheckResult> {
    let current_version = app.package_info().version.to_string();

    if !force.unwrap_or(false) {
        if let Some(cached) = android_update_cache_get(&current_version) {
            return Ok(cached);
        }
    }

    // GitHub REST API 对未认证请求按 IP 限流（60 次/小时），移动网络很容易撞上 403。
    // 先用 releases/latest 网页地址的重定向拿最新 tag（不受该限流），
    // API 只用来补充更新说明，失败也不影响判断是否有新版本。
    let mut latest_tag = fetch_latest_version_from_release_page().await;
    let release = fetch_latest_release_from_api().await.ok();

    if latest_tag.is_none() {
        latest_tag = release
            .as_ref()
            .map(|item| item.tag_name.trim_start_matches('v').trim().to_string())
            .filter(|tag| !tag.is_empty());
    }

    let Some(latest_tag) = latest_tag else {
        // 两条路都拿不到（限流、断网等），静默降级，不打扰用户。
        return Ok(AppUpdateCheckResult {
            current_version,
            available: false,
            version: None,
            notes: None,
            pub_date: None,
            manual_install_url: Some(ANDROID_RELEASE_PAGE_URL.to_string()),
        });
    };

    // 更新说明优先用仓库里的发布说明（raw 域名不受 REST API 限流），
    // 拿不到再退回 GitHub API 的 release body。
    let notes = release
        .as_ref()
        .and_then(|item| item.body.clone())
        .filter(|body| !body.trim().is_empty())
        .or(fetch_release_notes(&latest_tag).await);

    let result = AppUpdateCheckResult {
        available: latest_tag != current_version,
        current_version,
        version: Some(latest_tag),
        notes,
        pub_date: release.as_ref().and_then(|item| item.published_at.clone()),
        manual_install_url: Some(ANDROID_RELEASE_PAGE_URL.to_string()),
    };

    android_update_cache_set(&result);

    Ok(result)
}

#[cfg(target_os = "android")]
async fn fetch_latest_version_from_release_page() -> Option<String> {
    let client = reqwest::Client::builder()
        .user_agent("jm-boom-android-updater")
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .ok()?;
    let response = client.get(ANDROID_RELEASE_PAGE_URL).send().await.ok()?;

    if let Some(location) = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
    {
        if let Some(tag) = parse_release_tag(location) {
            return Some(tag);
        }
    }

    if response.status().is_success() {
        let body = response.text().await.ok()?;

        return parse_release_tag(&body);
    }

    None
}

/// 从仓库拉取发布说明，避免依赖被限流的 GitHub REST API。
#[cfg(target_os = "android")]
async fn fetch_release_notes(version: &str) -> Option<String> {
    let url = format!(
        "https://raw.githubusercontent.com/jfjdjdhsj/jm-boom-for-Android/master/docs/release-notes/v{version}.md"
    );
    let response = reqwest::Client::builder()
        .user_agent("jm-boom-android-updater")
        .timeout(Duration::from_secs(20))
        .build()
        .ok()?
        .get(&url)
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let body = response.text().await.ok()?;
    let trimmed = body.trim();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(target_os = "android")]
async fn fetch_latest_release_from_api() -> Result<AndroidGithubRelease, reqwest::Error> {
    reqwest::Client::builder()
        .user_agent("jm-boom-android-updater")
        .build()?
        .get(ANDROID_RELEASE_API_URL)
        .send()
        .await?
        .error_for_status()?
        .json::<AndroidGithubRelease>()
        .await
}

#[cfg(target_os = "android")]
fn parse_release_tag(input: &str) -> Option<String> {
    let start = input.find(RELEASE_TAG_MARKER)? + RELEASE_TAG_MARKER.len();
    let rest = &input[start..];
    let end = rest
        .find(|character: char| {
            !(character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_'))
        })
        .unwrap_or(rest.len());
    let tag = rest[..end].trim_start_matches('v').trim();

    if tag.is_empty() {
        None
    } else {
        Some(tag.to_string())
    }
}

/// App 启动时清理上一次残留的安装包。
#[cfg(target_os = "android")]
pub async fn cleanup_android_updates(app: &AppHandle) {
    let state = app.try_state::<UpdateInstaller<Wry>>();
    let Some(installer) = state.as_ref() else {
        return;
    };

    if let Err(error) = installer
        .handle
        .run_mobile_plugin_async::<AndroidInstallResponse>(
            "cleanUpdateDir",
            serde_json::json!({}),
        )
        .await
    {
        tracing::warn!(error = %error, "failed to clean stale update packages");
    }
}

/// 当前 APK 对应的 release 资源 ABI。
/// 传入 `None` 或 `auto` 时按当前设备的 CPU 架构自动选择。
#[cfg(target_os = "android")]
fn android_apk_abi(requested: Option<&str>) -> &'static str {
    let requested = requested
        .map(|value| value.trim())
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("auto"));

    match requested {
        Some("armeabi-v7a") => "armeabi-v7a",
        Some("x86_64") => "x86_64",
        Some("x86") => "x86",
        Some(_) => "arm64-v8a",
        None => match std::env::consts::ARCH {
            "aarch64" => "arm64-v8a",
            "arm" => "armeabi-v7a",
            "x86_64" => "x86_64",
            "x86" => "x86",
            _ => "arm64-v8a",
        },
    }
}

/// App 私有目录，用于存放待安装的 APK。
#[cfg(target_os = "android")]
async fn android_update_dir(app: &AppHandle) -> UpdateCommandResult<String> {
    let installer = app.state::<UpdateInstaller<Wry>>();
    let response: AndroidUpdateDirResponse = installer
        .handle
        .run_mobile_plugin_async("getUpdateDir", serde_json::json!({}))
        .await
        .map_err(|error| {
            ApiErrorDto::new(
                ApiErrorKind::Cache,
                format!("获取更新目录失败: {error}"),
            )
        })?;

    Ok(response.dir)
}

#[cfg(target_os = "android")]
fn android_emit_progress(app: &AppHandle, downloaded: u64, total: u64) {
    let percent = if total > 0 {
        (downloaded as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    let _ = app.emit(
        ANDROID_UPDATE_PROGRESS_EVENT,
        AppUpdateDownloadProgress {
            downloaded,
            total,
            percent,
        },
    );
}

/// 下载新的安装包前清掉旧包，避免私有目录堆积。
#[cfg(target_os = "android")]
fn android_remove_stale_apks(dir: &str, keep: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep {
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) == Some("apk") {
            let _ = std::fs::remove_file(path);
        }
    }
}

#[cfg(target_os = "android")]
fn android_download_path_cache() -> &'static Mutex<Option<String>> {
    static CACHE: std::sync::OnceLock<Mutex<Option<String>>> = std::sync::OnceLock::new();

    CACHE.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "android")]
fn android_remember_download_path(path: &str) {
    if let Ok(mut cache) = android_download_path_cache().lock() {
        *cache = Some(path.to_string());
    }
}

#[cfg(target_os = "android")]
fn android_remembered_download_path() -> Option<String> {
    android_download_path_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.clone())
}

#[cfg(target_os = "android")]
#[derive(Clone)]
struct AndroidUpdateCacheEntry {
    key: String,
    expires_at: Instant,
    result: AppUpdateCheckResult,
}

#[cfg(target_os = "android")]
fn android_update_cache() -> &'static std::sync::Mutex<Option<AndroidUpdateCacheEntry>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<Option<AndroidUpdateCacheEntry>>> =
        std::sync::OnceLock::new();

    CACHE.get_or_init(|| std::sync::Mutex::new(None))
}

#[cfg(target_os = "android")]
fn android_update_cache_get(current_version: &str) -> Option<AppUpdateCheckResult> {
    let cache = android_update_cache().lock().ok()?;
    let entry = cache.as_ref()?;

    if entry.key != current_version || Instant::now() >= entry.expires_at {
        return None;
    }

    Some(entry.result.clone())
}

#[cfg(target_os = "android")]
fn android_update_cache_set(result: &AppUpdateCheckResult) {
    if let Ok(mut cache) = android_update_cache().lock() {
        *cache = Some(AndroidUpdateCacheEntry {
            key: result.current_version.clone(),
            expires_at: Instant::now() + ANDROID_UPDATE_CACHE_TTL,
            result: result.clone(),
        });
    }
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct AndroidGithubRelease {
    tag_name: String,
    body: Option<String>,
    published_at: Option<String>,
}

#[tauri::command]
#[cfg(not(target_os = "android"))]
pub async fn install_app_update(app: AppHandle, path: Option<String>) -> UpdateCommandResult<bool> {
    // 桌面端由 updater 插件自行下载安装，path 只在 Android 使用。
    let _ = path;
    let updater = build_updater(&app).map_err(ApiErrorDto::from)?;

    let Some(update) = updater.check().await.map_err(|error| {
        ApiErrorDto::new(ApiErrorKind::Network, format!("检查更新失败: {error}"))
    })?
    else {
        return Ok(false);
    };

    let bytes = update.download(|_, _| {}, || {}).await.map_err(|error| {
        ApiErrorDto::new(ApiErrorKind::Network, format!("下载更新失败: {error}"))
    })?;

    update
        .install(bytes)
        .map_err(|error| ApiErrorDto::new(ApiErrorKind::Cache, format!("安装更新失败: {error}")))?;

    #[cfg(not(target_os = "windows"))]
    app.restart();

    Ok(true)
}

/// 桌面端由 updater 插件直接下载安装，不需要先落盘安装包。
#[tauri::command]
#[cfg(not(target_os = "android"))]
pub async fn download_app_update(
    version: String,
    abi: Option<String>,
) -> UpdateCommandResult<AppUpdateDownloadResult> {
    // 桌面端安装包由 updater 插件自行处理，不需要选择 ABI。
    let _ = abi;

    Err(ApiErrorDto::new(
        ApiErrorKind::UnsupportedEndpoint,
        format!("桌面端无需提前下载更新包 {version}"),
    ))
}

/// 把最新版 APK 下载到 App 私有目录（不经过浏览器）。
#[tauri::command]
#[cfg(target_os = "android")]
pub async fn download_app_update(
    app: AppHandle,
    version: String,
    abi: Option<String>,
) -> UpdateCommandResult<AppUpdateDownloadResult> {
    let tag = format!("v{}", version.trim_start_matches('v').trim());
    let abi = android_apk_abi(abi.as_deref());
    let url = ANDROID_APK_URL_TEMPLATE
        .replace("{tag}", &tag)
        .replace("{abi}", abi);

    let dir = android_update_dir(&app).await?;
    std::fs::create_dir_all(&dir).map_err(|error| {
        ApiErrorDto::new(
            ApiErrorKind::Cache,
            format!("创建更新目录失败 {dir}: {error}"),
        )
    })?;

    let file_path = Path::new(&dir).join(format!("JM-Boom-{tag}.apk"));
    android_remove_stale_apks(&dir, &file_path);

    let mut response = reqwest::Client::builder()
        .user_agent("jm-boom-android-updater")
        .timeout(ANDROID_DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|error| {
            ApiErrorDto::new(
                ApiErrorKind::Network,
                format!("初始化下载器失败: {error}"),
            )
        })?
        .get(&url)
        .send()
        .await
        .map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Network, format!("下载更新失败: {error}"))
        })?
        .error_for_status()
        .map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Network, format!("下载更新失败: {error}"))
        })?;

    let total = response.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(&file_path).map_err(|error| {
        ApiErrorDto::new(ApiErrorKind::Cache, format!("创建安装包失败: {error}"))
    })?;
    let mut downloaded = 0u64;
    let mut last_emit = Instant::now();

    while let Some(chunk) = response.chunk().await.map_err(|error| {
        ApiErrorDto::new(ApiErrorKind::Network, format!("下载更新失败: {error}"))
    })? {
        file.write_all(&chunk).map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Cache, format!("写入安装包失败: {error}"))
        })?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(120) {
            last_emit = Instant::now();
            android_emit_progress(&app, downloaded, total);
        }
    }

    file.flush()
        .map_err(|error| ApiErrorDto::new(ApiErrorKind::Cache, format!("写入安装包失败: {error}")))?;
    drop(file);
    android_emit_progress(&app, downloaded, total);

    let path = file_path.to_string_lossy().to_string();
    android_remember_download_path(&path);

    Ok(AppUpdateDownloadResult {
        version: tag.trim_start_matches('v').to_string(),
        path,
    })
}

#[tauri::command]
#[cfg(target_os = "android")]
pub async fn install_app_update(
    app: AppHandle,
    path: Option<String>,
) -> UpdateCommandResult<bool> {
    let apk_path = path
        .filter(|value| !value.trim().is_empty())
        .or_else(android_remembered_download_path)
        .ok_or_else(|| {
            ApiErrorDto::new(ApiErrorKind::Cache, "没有可安装的更新包，请先下载")
        })?;

    let installer = app.state::<UpdateInstaller<Wry>>();
    installer
        .handle
        .run_mobile_plugin_async::<AndroidInstallResponse>(
            "installApk",
            serde_json::json!({ "path": apk_path }),
        )
        .await
        .map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Cache, format!("安装更新失败: {error}"))
        })?;

    Ok(true)
}

#[cfg(not(target_os = "android"))]
fn build_updater(app: &AppHandle) -> ApiResult<Updater> {
    let mut builder = app.updater_builder();

    if let Some(proxy_url) = api::current_proxy_url()? {
        let proxy = Url::parse(&proxy_url).map_err(|error| {
            ApiError::new(
                ApiErrorKind::UnsupportedEndpoint,
                format!("解析更新代理失败 {proxy_url}: {error}"),
            )
        })?;
        builder = builder.proxy(proxy);
    }

    builder
        .build()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, format!("初始化更新器失败: {error}")))
}

#[cfg(not(target_os = "android"))]
fn app_update_cache_key(current_version: &str) -> String {
    format!("app_update_check:v1:{current_version}")
}

#[cfg(not(target_os = "android"))]
async fn runtime_cache_get<T>(cache_key: &str) -> Option<T>
where
    T: serde::de::DeserializeOwned,
{
    match runtime_cache::get(APP_UPDATE_CACHE_KIND, cache_key).await {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(
                cache_kind = APP_UPDATE_CACHE_KIND,
                cache_key = %cache_key,
                error = %error,
                "failed to read app update cache"
            );
            None
        }
    }
}

#[cfg(not(target_os = "android"))]
async fn runtime_cache_set<T>(cache_key: &str, value: &T, ttl: Duration)
where
    T: Serialize,
{
    if let Err(error) = runtime_cache::set(APP_UPDATE_CACHE_KIND, cache_key, value, ttl).await {
        tracing::warn!(
            cache_kind = APP_UPDATE_CACHE_KIND,
            cache_key = %cache_key,
            error = %error,
            "failed to write app update cache"
        );
    }
}
