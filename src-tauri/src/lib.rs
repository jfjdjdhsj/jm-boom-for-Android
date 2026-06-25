mod api;

use api::{RemoteSettingResult, SearchAlbumsResult};

#[tauri::command]
async fn get_remote_setting(endpoint: Option<String>) -> Result<RemoteSettingResult, String> {
    api::get_remote_setting(endpoint)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn search_comics(
    query: String,
    page: Option<u32>,
    endpoint: Option<String>,
) -> Result<SearchAlbumsResult, String> {
    api::search_comics(query, page, endpoint)
        .await
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_remote_setting, search_comics])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
