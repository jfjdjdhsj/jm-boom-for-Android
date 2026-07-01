#[cfg(not(target_os = "android"))]
use crate::api::{self, ApiError, ApiResult};
use crate::api::{ApiErrorDto, ApiErrorKind};
#[cfg(not(target_os = "android"))]
use crate::storage::runtime_cache;
use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "android"))]
use std::time::Duration;
use tauri::AppHandle;
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

type UpdateCommandResult<T> = Result<T, ApiErrorDto>;

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
    _force: Option<bool>,
) -> UpdateCommandResult<AppUpdateCheckResult> {
    let current_version = app.package_info().version.to_string();
    let release = reqwest::Client::builder()
        .user_agent("jm-boom-android-updater")
        .build()
        .map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Client, format!("初始化更新检查失败: {error}"))
        })?
        .get(ANDROID_RELEASE_API_URL)
        .send()
        .await
        .map_err(|error| ApiErrorDto::new(ApiErrorKind::Network, format!("检查更新失败: {error}")))?
        .error_for_status()
        .map_err(|error| ApiErrorDto::new(ApiErrorKind::Network, format!("检查更新失败: {error}")))?
        .json::<AndroidGithubRelease>()
        .await
        .map_err(|error| {
            ApiErrorDto::new(ApiErrorKind::Client, format!("解析更新信息失败: {error}"))
        })?;
    let version = release.tag_name.trim_start_matches('v').to_string();
    let available = version != current_version;

    Ok(AppUpdateCheckResult {
        current_version,
        available,
        version: Some(version),
        notes: release.body,
        pub_date: release.published_at,
        manual_install_url: Some(ANDROID_RELEASE_PAGE_URL.to_string()),
    })
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
pub async fn install_app_update(app: AppHandle) -> UpdateCommandResult<bool> {
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

#[tauri::command]
#[cfg(target_os = "android")]
pub async fn install_app_update(_app: AppHandle) -> UpdateCommandResult<bool> {
    Ok(false)
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
