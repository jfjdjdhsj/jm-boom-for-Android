use crate::api::{resolve_api_endpoint, ApiError, ApiErrorKind, ApiResult};
use crate::reader;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::async_runtime::{self, JoinHandle};
use tauri::{AppHandle, Manager};

static DOWNLOAD_MANAGER: OnceLock<Arc<DownloadManager>> = OnceLock::new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueDownloadRequest {
    pub album_id: String,
    pub comic_title: String,
    pub endpoint: Option<String>,
    pub chapters: Vec<DownloadChapterRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadChapterRequest {
    pub chapter_id: String,
    pub title: String,
    pub order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub task_id: String,
    pub album_id: String,
    pub comic_title: String,
    pub endpoint: String,
    pub chapters: Vec<DownloadChapterRequest>,
    pub status: DownloadTaskStatus,
    pub current_chapter_title: String,
    pub total_pages: u32,
    pub completed_pages: u32,
    pub eta_seconds: Option<u64>,
    pub speed_bytes_per_second: u64,
    pub output_dir: String,
    pub error: Option<String>,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub updated_at: u64,
    pub completed_at: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DownloadTaskStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskListResult {
    pub root_dir: String,
    pub tasks: Vec<DownloadTask>,
}

struct DownloadManager {
    app: AppHandle,
    state: Mutex<DownloadState>,
}

#[derive(Default)]
struct DownloadState {
    tasks: Vec<DownloadTask>,
    worker: Option<JoinHandle<()>>,
}

pub fn enqueue_comic_download(
    app: AppHandle,
    request: EnqueueDownloadRequest,
) -> Result<DownloadTaskListResult, String> {
    let manager = download_manager(app);
    manager
        .enqueue(request)
        .map_err(|error| error.to_string())?;
    manager.list().map_err(|error| error.to_string())
}

pub fn list_download_tasks(app: AppHandle) -> Result<DownloadTaskListResult, String> {
    download_manager(app)
        .list()
        .map_err(|error| error.to_string())
}

pub fn cancel_download_task(app: AppHandle, task_id: String) -> Result<DownloadTaskListResult, String> {
    let manager = download_manager(app);
    manager
        .cancel(task_id)
        .map_err(|error| error.to_string())?;
    manager.list().map_err(|error| error.to_string())
}

pub fn pause_download_task(app: AppHandle, task_id: String) -> Result<DownloadTaskListResult, String> {
    let manager = download_manager(app);
    manager
        .pause(task_id)
        .map_err(|error| error.to_string())?;
    manager.list().map_err(|error| error.to_string())
}

pub fn resume_download_task(app: AppHandle, task_id: String) -> Result<DownloadTaskListResult, String> {
    let manager = download_manager(app);
    manager
        .resume(task_id)
        .map_err(|error| error.to_string())?;
    manager.list().map_err(|error| error.to_string())
}

pub fn remove_download_task(app: AppHandle, task_id: String) -> Result<DownloadTaskListResult, String> {
    let manager = download_manager(app);
    manager
        .remove(task_id)
        .map_err(|error| error.to_string())?;
    manager.list().map_err(|error| error.to_string())
}

pub fn open_download_task_dir(app: AppHandle, task_id: String) -> Result<(), String> {
    download_manager(app)
        .open_task_dir(task_id)
        .map_err(|error| error.to_string())
}

pub fn open_download_root_dir(app: AppHandle) -> Result<(), String> {
    let root = download_files_root(&app).map_err(|error| error.to_string())?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    tauri_plugin_opener::open_path(&root, None::<&str>).map_err(|error| error.to_string())
}

fn download_manager(app: AppHandle) -> Arc<DownloadManager> {
    DOWNLOAD_MANAGER
        .get_or_init(|| {
            Arc::new(DownloadManager {
                app,
                state: Mutex::new(DownloadState::default()),
            })
        })
        .clone()
}

impl DownloadManager {
    fn enqueue(self: &Arc<Self>, request: EnqueueDownloadRequest) -> ApiResult<()> {
        let album_id = normalize_required(&request.album_id, "album_id")?;
        let comic_title = normalize_required(&request.comic_title, "comic_title")?;
        let endpoint = resolve_api_endpoint(request.endpoint)?;
        let chapters = normalize_chapters(request.chapters)?;
        self.load_tasks_if_needed()?;
        let now = current_timestamp();
        let task_id = format!("{now}-{}", short_hash(&format!("{album_id}-{comic_title}-{now}")));
        let output_dir = task_output_dir(&self.app, &comic_title)?.to_string_lossy().to_string();
        let task = DownloadTask {
            task_id,
            album_id,
            comic_title,
            endpoint,
            chapters,
            status: DownloadTaskStatus::Queued,
            current_chapter_title: String::new(),
            total_pages: 0,
            completed_pages: 0,
            eta_seconds: None,
            speed_bytes_per_second: 0,
            output_dir,
            error: None,
            created_at: now,
            started_at: None,
            updated_at: now,
            completed_at: None,
        };

        {
            let mut state = self.lock_state()?;
            state.tasks.push(task);
            persist_tasks(&self.app, &state.tasks)?;
        }

        self.ensure_worker();

        Ok(())
    }

    fn list(self: &Arc<Self>) -> ApiResult<DownloadTaskListResult> {
        self.load_tasks_if_needed()?;
        let mut tasks = self.lock_state()?.tasks.clone();
        let should_resume_worker = tasks
            .iter()
            .any(|task| task.status == DownloadTaskStatus::Queued);
        tasks.sort_by_key(|task| std::cmp::Reverse(task.created_at));

        if should_resume_worker {
            self.ensure_worker();
        }

        Ok(DownloadTaskListResult {
            root_dir: download_files_root(&self.app)?.to_string_lossy().to_string(),
            tasks,
        })
    }

    fn cancel(self: &Arc<Self>, task_id: String) -> ApiResult<()> {
        let task_id = task_id.trim();
        if task_id.is_empty() {
            return Ok(());
        }

        let mut state = self.lock_state()?;
        if let Some(task) = state.tasks.iter_mut().find(|task| task.task_id == task_id) {
            if matches!(
                task.status,
                DownloadTaskStatus::Queued | DownloadTaskStatus::Running | DownloadTaskStatus::Paused
            ) {
                task.status = DownloadTaskStatus::Cancelled;
                task.updated_at = current_timestamp();
                task.completed_at = Some(task.updated_at);
                task.eta_seconds = None;
                task.speed_bytes_per_second = 0;
                task.error = None;
            }
        }
        persist_tasks(&self.app, &state.tasks)
    }

    fn pause(&self, task_id: String) -> ApiResult<()> {
        let task_id = task_id.trim();
        if task_id.is_empty() {
            return Ok(());
        }

        let mut state = self.lock_state()?;
        if let Some(task) = state.tasks.iter_mut().find(|task| task.task_id == task_id) {
            if matches!(
                task.status,
                DownloadTaskStatus::Queued | DownloadTaskStatus::Running
            ) {
                task.status = DownloadTaskStatus::Paused;
                task.updated_at = current_timestamp();
                task.completed_at = None;
                task.eta_seconds = None;
                task.speed_bytes_per_second = 0;
                task.error = None;
            }
        }
        persist_tasks(&self.app, &state.tasks)
    }

    fn resume(self: &Arc<Self>, task_id: String) -> ApiResult<()> {
        let task_id = task_id.trim();
        if task_id.is_empty() {
            return Ok(());
        }

        let mut resumed = false;
        {
            let mut state = self.lock_state()?;
            if let Some(task) = state.tasks.iter_mut().find(|task| task.task_id == task_id) {
                if matches!(
                    task.status,
                    DownloadTaskStatus::Paused | DownloadTaskStatus::Failed
                ) {
                    task.status = DownloadTaskStatus::Queued;
                    task.started_at = None;
                    task.completed_at = None;
                    task.current_chapter_title.clear();
                    task.total_pages = 0;
                    task.completed_pages = 0;
                    task.eta_seconds = None;
                    task.speed_bytes_per_second = 0;
                    task.error = None;
                    task.updated_at = current_timestamp();
                    resumed = true;
                }
            }
            persist_tasks(&self.app, &state.tasks)?;
        }

        if resumed {
            self.ensure_worker();
        }

        Ok(())
    }

    fn remove(&self, task_id: String) -> ApiResult<()> {
        let task_id = task_id.trim();
        if task_id.is_empty() {
            return Ok(());
        }

        let mut state = self.lock_state()?;
        let task_to_remove = state
            .tasks
            .iter()
            .find(|task| task.task_id == task_id && task.status != DownloadTaskStatus::Running)
            .cloned();
        if let Some(task) = &task_to_remove {
            remove_task_files(&self.app, task)?;
        }
        state.tasks.retain(|task| {
            if task.task_id != task_id {
                return true;
            }

            matches!(task.status, DownloadTaskStatus::Running)
        });
        persist_tasks(&self.app, &state.tasks)
    }

    fn open_task_dir(&self, task_id: String) -> ApiResult<()> {
        let task_id = task_id.trim();
        let task = self
            .lock_state()?
            .tasks
            .iter()
            .find(|task| task.task_id == task_id)
            .cloned()
            .ok_or_else(|| ApiError::new(ApiErrorKind::MissingData, "Download task not found"))?;
        let output_dir = PathBuf::from(task.output_dir);
        fs::create_dir_all(&output_dir).map_err(map_download_error)?;
        tauri_plugin_opener::open_path(&output_dir, None::<&str>)
            .map_err(|error| ApiError::new(ApiErrorKind::Cache, error.to_string()))
    }

    fn ensure_worker(self: &Arc<Self>) {
        let mut state = match self.state.lock() {
            Ok(state) => state,
            Err(_) => return,
        };

        let worker_active = state
            .worker
            .as_ref()
            .is_some_and(|worker| !worker.inner().is_finished());
        if worker_active {
            return;
        }

        let manager = self.clone();
        state.worker = Some(async_runtime::spawn(async move {
            manager.process_queue().await;
        }));
    }

    async fn process_queue(self: Arc<Self>) {
        loop {
            let next_task = match self.mark_next_task_running() {
                Ok(task) => task,
                Err(error) => {
                    eprintln!("Failed to read download queue: {error}");
                    None
                }
            };

            let Some(task) = next_task else {
                if let Ok(mut state) = self.state.lock() {
                    state.worker = None;
                }
                return;
            };

            let result = self.run_task(task.clone()).await;
            if let Err(error) = result {
                let _ = self.mark_task_failed(&task.task_id, error.to_string());
            }
        }
    }

    fn mark_next_task_running(&self) -> ApiResult<Option<DownloadTask>> {
        self.load_tasks_if_needed()?;
        let mut state = self.lock_state()?;
        let Some(index) = state
            .tasks
            .iter()
            .position(|task| task.status == DownloadTaskStatus::Queued)
        else {
            return Ok(None);
        };
        let now = current_timestamp();
        let task = &mut state.tasks[index];
        task.status = DownloadTaskStatus::Running;
        task.started_at = Some(now);
        task.updated_at = now;
        task.completed_at = None;
        task.current_chapter_title.clear();
        task.total_pages = 0;
        task.completed_pages = 0;
        task.eta_seconds = None;
        task.speed_bytes_per_second = 0;
        task.error = None;
        let task = task.clone();
        persist_tasks(&self.app, &state.tasks)?;

        Ok(Some(task))
    }

    async fn run_task(&self, task: DownloadTask) -> ApiResult<()> {
        let task_started_at = std::time::Instant::now();
        let mut completed_pages: u32 = 0;
        let mut total_pages: u32 = 0;
        let mut downloaded_bytes: u64 = 0;
        let mut manifests = VecDeque::new();

        for chapter in &task.chapters {
            self.ensure_task_can_continue(&task.task_id)?;
            let manifest = reader::get_or_load_manifest(
                chapter.chapter_id.clone(),
                Some(task.endpoint.clone()),
            )
            .await?;
            total_pages = total_pages.saturating_add(manifest.page_count());
            manifests.push_back((chapter.clone(), manifest));
            self.update_task(&task.task_id, |task| {
                task.total_pages = total_pages;
                task.current_chapter_title = chapter.title.clone();
            })?;
        }

        while let Some((chapter, manifest)) = manifests.pop_front() {
            self.ensure_task_can_continue(&task.task_id)?;
            self.update_task(&task.task_id, |task| {
                task.current_chapter_title = chapter.title.clone();
            })?;
            let chapter_dir = download_chapter_dir(&task.output_dir, &chapter);

            for index in 0..manifest.page_count() {
                self.ensure_task_can_continue(&task.task_id)?;
                let extension = reader::reader_page_output_extension(&manifest, index)?;
                let target_path = chapter_dir.join(format!("{:04}.{extension}", index + 1));
                let (_, _, is_cached) =
                    reader::materialize_reader_page_to_path(&manifest, index, target_path.clone())
                        .await?;
                completed_pages = completed_pages.saturating_add(1);
                if !is_cached {
                    downloaded_bytes =
                        downloaded_bytes.saturating_add(file_size_bytes(&target_path).unwrap_or(0));
                }
                let eta_seconds = estimate_eta(task_started_at.elapsed(), completed_pages, total_pages);
                let speed_bytes_per_second =
                    estimate_speed(task_started_at.elapsed(), downloaded_bytes);
                self.update_task(&task.task_id, |task| {
                    task.completed_pages = completed_pages;
                    task.total_pages = total_pages;
                    task.eta_seconds = eta_seconds;
                    task.speed_bytes_per_second = speed_bytes_per_second;
                    task.current_chapter_title = chapter.title.clone();
                })?;
            }
        }

        self.update_task(&task.task_id, |task| {
            let now = current_timestamp();
            task.status = DownloadTaskStatus::Completed;
            task.completed_pages = total_pages;
            task.total_pages = total_pages;
            task.eta_seconds = Some(0);
            task.speed_bytes_per_second = 0;
            task.updated_at = now;
            task.completed_at = Some(now);
        })
    }

    fn ensure_task_can_continue(&self, task_id: &str) -> ApiResult<()> {
        let status = self
            .lock_state()?
            .tasks
            .iter()
            .find(|task| task.task_id == task_id)
            .map(|task| task.status)
            .unwrap_or(DownloadTaskStatus::Cancelled);

        if status == DownloadTaskStatus::Cancelled {
            return Err(ApiError::new(ApiErrorKind::Cache, "Download task cancelled"));
        }

        if status == DownloadTaskStatus::Paused {
            return Err(ApiError::new(ApiErrorKind::Cache, "Download task paused"));
        }

        Ok(())
    }

    fn mark_task_failed(&self, task_id: &str, message: String) -> ApiResult<()> {
        self.update_task(task_id, |task| {
            if matches!(
                task.status,
                DownloadTaskStatus::Cancelled | DownloadTaskStatus::Paused
            ) {
                return;
            }

            let now = current_timestamp();
            task.status = DownloadTaskStatus::Failed;
            task.error = Some(message);
            task.eta_seconds = None;
            task.speed_bytes_per_second = 0;
            task.updated_at = now;
            task.completed_at = Some(now);
        })
    }

    fn update_task<F>(&self, task_id: &str, update: F) -> ApiResult<()>
    where
        F: FnOnce(&mut DownloadTask),
    {
        let mut state = self.lock_state()?;
        if let Some(task) = state.tasks.iter_mut().find(|task| task.task_id == task_id) {
            update(task);
            if task.status != DownloadTaskStatus::Completed {
                task.updated_at = current_timestamp();
            }
        }
        persist_tasks(&self.app, &state.tasks)
    }

    fn load_tasks_if_needed(&self) -> ApiResult<()> {
        let mut state = self.lock_state()?;
        if !state.tasks.is_empty() {
            return Ok(());
        }

        state.tasks = load_tasks(&self.app)?;
        let recovered = recover_interrupted_tasks(&mut state.tasks);
        let migrated = migrate_pending_task_output_dirs(&self.app, &mut state.tasks)?;
        if recovered || migrated {
            persist_tasks(&self.app, &state.tasks)?;
        }

        Ok(())
    }

    fn lock_state(&self) -> ApiResult<std::sync::MutexGuard<'_, DownloadState>> {
        self.state
            .lock()
            .map_err(|_| ApiError::new(ApiErrorKind::Cache, "Download state lock poisoned"))
    }
}

fn recover_interrupted_tasks(tasks: &mut [DownloadTask]) -> bool {
    let now = current_timestamp();
    let mut recovered = false;

    for task in tasks {
        if task.status != DownloadTaskStatus::Running {
            continue;
        }

        task.status = DownloadTaskStatus::Queued;
        task.started_at = None;
        task.completed_at = None;
        task.current_chapter_title.clear();
        task.total_pages = 0;
        task.completed_pages = 0;
        task.eta_seconds = None;
        task.speed_bytes_per_second = 0;
        task.error = None;
        task.updated_at = now;
        recovered = true;
    }

    recovered
}

fn migrate_pending_task_output_dirs(app: &AppHandle, tasks: &mut [DownloadTask]) -> ApiResult<bool> {
    let mut migrated = false;

    for task in tasks {
        if !matches!(
            task.status,
            DownloadTaskStatus::Queued | DownloadTaskStatus::Running
                | DownloadTaskStatus::Paused
        ) {
            continue;
        }

        let output_dir = task_output_dir(app, &task.comic_title)?
            .to_string_lossy()
            .to_string();
        if task.output_dir == output_dir {
            continue;
        }

        task.output_dir = output_dir;
        task.updated_at = current_timestamp();
        migrated = true;
    }

    Ok(migrated)
}

fn normalize_chapters(chapters: Vec<DownloadChapterRequest>) -> ApiResult<Vec<DownloadChapterRequest>> {
    let chapters = chapters
        .into_iter()
        .filter_map(|chapter| {
            let chapter_id = chapter.chapter_id.trim().to_string();
            if chapter_id.is_empty() {
                return None;
            }

            Some(DownloadChapterRequest {
                chapter_id,
                title: if chapter.title.trim().is_empty() {
                    "正文".to_string()
                } else {
                    chapter.title.trim().to_string()
                },
                order: chapter.order,
            })
        })
        .collect::<Vec<_>>();

    if chapters.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Download needs at least one chapter",
        ));
    }

    Ok(chapters)
}

fn normalize_required(value: &str, field: &str) -> ApiResult<String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            format!("Download needs {field}"),
        ));
    }

    Ok(value.to_string())
}

fn tasks_path(app: &AppHandle) -> ApiResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("downloads").join("task.json"))
        .map_err(|error| ApiError::new(ApiErrorKind::Cache, error.to_string()))
}

fn download_files_root(app: &AppHandle) -> ApiResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("downloads").join("file"))
        .map_err(|error| ApiError::new(ApiErrorKind::Cache, error.to_string()))
}

fn task_output_dir(app: &AppHandle, comic_title: &str) -> ApiResult<PathBuf> {
    Ok(download_files_root(app)?.join(safe_path_segment(comic_title)))
}

fn download_chapter_dir(output_dir: &str, chapter: &DownloadChapterRequest) -> PathBuf {
    PathBuf::from(output_dir).join(safe_path_segment(&chapter.title))
}

fn remove_task_files(app: &AppHandle, task: &DownloadTask) -> ApiResult<()> {
    let root = download_files_root(app)?;
    let root = match fs::canonicalize(root) {
        Ok(path) => path,
        Err(_) => return Ok(()),
    };
    let output_dir = PathBuf::from(&task.output_dir);

    for chapter in &task.chapters {
        let chapter_dir = download_chapter_dir(&task.output_dir, chapter);
        if !chapter_dir.exists() {
            continue;
        }
        let chapter_dir = fs::canonicalize(chapter_dir).map_err(map_download_error)?;
        if !chapter_dir.starts_with(&root) {
            continue;
        }

        if chapter_dir.is_dir() {
            fs::remove_dir_all(&chapter_dir).map_err(map_download_error)?;
        } else {
            fs::remove_file(&chapter_dir).map_err(map_download_error)?;
        }
    }

    if output_dir.exists() && output_dir.is_dir() {
        let output_dir = fs::canonicalize(output_dir).map_err(map_download_error)?;
        if output_dir.starts_with(&root) && is_directory_empty(&output_dir)? {
            fs::remove_dir(&output_dir).map_err(map_download_error)?;
        }
    }

    Ok(())
}

fn is_directory_empty(path: &PathBuf) -> ApiResult<bool> {
    let mut entries = fs::read_dir(path).map_err(map_download_error)?;

    Ok(entries.next().is_none())
}

fn load_tasks(app: &AppHandle) -> ApiResult<Vec<DownloadTask>> {
    let path = tasks_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = fs::read(&path).map_err(map_download_error)?;
    serde_json::from_slice(&bytes)
        .map_err(|error| ApiError::new(ApiErrorKind::Payload, error.to_string()))
}

fn persist_tasks(app: &AppHandle, tasks: &[DownloadTask]) -> ApiResult<()> {
    let path = tasks_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(map_download_error)?;
    }
    let bytes = serde_json::to_vec_pretty(tasks)
        .map_err(|error| ApiError::new(ApiErrorKind::Payload, error.to_string()))?;
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, bytes).map_err(map_download_error)?;
    fs::rename(&temp_path, &path).map_err(map_download_error)
}

fn estimate_eta(elapsed: Duration, completed_pages: u32, total_pages: u32) -> Option<u64> {
    if completed_pages == 0 || total_pages <= completed_pages {
        return Some(0);
    }

    let per_page = elapsed.as_secs_f64() / completed_pages as f64;
    Some(((total_pages - completed_pages) as f64 * per_page).ceil() as u64)
}

fn estimate_speed(elapsed: Duration, downloaded_bytes: u64) -> u64 {
    let elapsed_seconds = elapsed.as_secs_f64();
    if downloaded_bytes == 0 || elapsed_seconds <= 0.0 {
        return 0;
    }

    (downloaded_bytes as f64 / elapsed_seconds).round() as u64
}

fn file_size_bytes(path: &PathBuf) -> Option<u64> {
    fs::metadata(path).map(|metadata| metadata.len()).ok()
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn short_hash(value: &str) -> String {
    format!("{:x}", md5::compute(value))
        .chars()
        .take(8)
        .collect()
}

fn safe_path_segment(value: &str) -> String {
    let segment = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(character, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
            {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim_matches(['.', ' '])
        .to_string();

    if segment.is_empty() {
        "unknown".to_string()
    } else {
        segment
    }
}

fn map_download_error(error: std::io::Error) -> ApiError {
    ApiError::new(ApiErrorKind::Cache, error.to_string())
}
