mod db;
mod migrations;
pub(crate) mod runtime_cache;
pub(crate) mod session;

use sqlx::SqlitePool;
use std::sync::OnceLock;
use tauri::AppHandle;

static STORAGE_POOL: OnceLock<SqlitePool> = OnceLock::new();

pub(crate) async fn init(app: &AppHandle) -> Result<(), String> {
    if STORAGE_POOL.get().is_some() {
        return Ok(());
    }

    let pool = db::connect(app).await?;
    migrations::run(&pool).await?;

    let _ = STORAGE_POOL.set(pool);

    Ok(())
}

pub(crate) fn pool() -> Result<&'static SqlitePool, String> {
    STORAGE_POOL
        .get()
        .ok_or_else(|| "SQLite storage is not initialized".to_string())
}
