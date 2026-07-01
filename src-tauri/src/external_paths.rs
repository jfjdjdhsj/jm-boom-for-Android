#[cfg(target_os = "android")]
use std::path::PathBuf;

#[cfg(target_os = "android")]
pub const ANDROID_EXTERNAL_ROOT: &str = "/storage/emulated/0/jj-boom";

#[cfg(target_os = "android")]
pub fn android_external_dir(name: &str) -> PathBuf {
    PathBuf::from(ANDROID_EXTERNAL_ROOT).join(name)
}
