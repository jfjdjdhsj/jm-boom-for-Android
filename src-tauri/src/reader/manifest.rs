use super::types::{ReaderManifest, ReaderPage};
use crate::api::{
    build_http_client, current_jwt_token, lossy_string_from_scalar, resolve_api_endpoint,
    resolve_cached_img_host, ApiError, ApiErrorKind, ApiResult,
};
use aes::Aes256;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use ecb::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyInit};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const JM_API_VERSION: &str = "2.0.20";
const JM_API_SECRET: &str = "185Hcomic3PAPP7R";

static MANIFEST_CACHE: OnceLock<Mutex<HashMap<String, ReaderManifest>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct ReaderChapterPayload {
    #[serde(default, deserialize_with = "lossy_string_from_scalar")]
    id: String,
    #[serde(default)]
    images: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ReaderChapterEnvelope {
    images: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ReaderApiEnvelope {
    #[serde(default)]
    code: i32,
    data: Option<serde_json::Value>,
    #[serde(default, rename = "errorMsg")]
    error_msg: Option<String>,
}

pub(crate) async fn get_or_load_manifest(
    read_id: String,
    endpoint: Option<String>,
) -> ApiResult<ReaderManifest> {
    let read_id = normalize_read_id(read_id)?;
    let endpoint = resolve_api_endpoint(endpoint)?;
    let cache_key = manifest_cache_key(&endpoint, &read_id);

    if let Some(manifest) = cached_manifest(&cache_key) {
        return Ok(manifest);
    }

    let client = build_http_client()?;
    let img_host = resolve_cached_img_host(&client, &endpoint).await?;
    let chapter =
        request_reader_chapter(&client, &endpoint, &read_id, &ReaderApiRequest::current()).await?;
    let manifest = build_reader_manifest(&endpoint, &read_id, &img_host, chapter)?;
    cache_manifest(cache_key, manifest.clone());

    Ok(manifest)
}

async fn request_reader_chapter(
    client: &reqwest::Client,
    endpoint: &str,
    read_id: &str,
    api_request: &ReaderApiRequest,
) -> ApiResult<ReaderChapterPayload> {
    let request_name = format!("{endpoint}/chapter");
    let request = client
        .get(&request_name)
        .header("accept", "application/json")
        .header("token", &api_request.token)
        .header("tokenparam", &api_request.tokenparam)
        .header("user-agent", android_user_agent())
        .header("Host", url_host(&request_name));
    let request = if let Some(jwt) = current_jwt_token()? {
        request.header("Authorization", format!("Bearer {jwt}"))
    } else {
        request
    };
    let response = request
        .query(&[("skip", ""), ("id", read_id)])
        .send()
        .await
        .map_err(|error| {
            ApiError::new(ApiErrorKind::Network, format!("{request_name}: {error}"))
        })?;

    if !response.status().is_success() {
        return Err(ApiError::new(
            ApiErrorKind::Http,
            format!("{request_name}: API returned HTTP {}", response.status()),
        ));
    }

    let body = response.text().await.map_err(|error| {
        ApiError::new(ApiErrorKind::Network, format!("{request_name}: {error}"))
    })?;

    decode_plugin_payload::<ReaderChapterPayload>(body.trim(), &api_request.ts)
        .or_else(|_| {
            serde_json::from_str::<ReaderChapterEnvelope>(body.trim()).map(|payload| {
                ReaderChapterPayload {
                    id: read_id.to_string(),
                    images: payload.images,
                }
            })
        })
        .map_err(|error| {
            ApiError::new(
                ApiErrorKind::Payload,
                format!(
                    "{request_name}: Invalid chapter payload: {error}. Body starts with: {}",
                    reader_response_preview(&body)
                ),
            )
        })
}

fn build_reader_manifest(
    endpoint: &str,
    read_id: &str,
    img_host: &str,
    chapter: ReaderChapterPayload,
) -> ApiResult<ReaderManifest> {
    if chapter.images.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "chapter did not include page images",
        ));
    }

    let img_host = img_host.trim().trim_end_matches('/');
    if img_host.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "setting did not include image host",
        ));
    }

    let chapter_id = if chapter.id.trim().is_empty() {
        read_id
    } else {
        chapter.id.trim()
    };
    let pages = chapter
        .images
        .into_iter()
        .enumerate()
        .filter_map(|(index, image)| {
            let image = image.trim().to_string();

            if image.is_empty() {
                return None;
            }

            Some(ReaderPage {
                index: index as u32,
                page_name: page_name_from_image(&image),
                source_url: format!("{img_host}/media/photos/{chapter_id}/{image}"),
            })
        })
        .collect::<Vec<_>>();

    if pages.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "chapter page image list is empty",
        ));
    }

    Ok(ReaderManifest {
        endpoint: endpoint.to_string(),
        read_id: read_id.to_string(),
        read_id_number: read_id.parse::<u32>().unwrap_or_default(),
        pages,
    })
}

#[derive(Debug, Clone)]
struct ReaderApiRequest {
    ts: String,
    token: String,
    tokenparam: String,
}

impl ReaderApiRequest {
    fn current() -> Self {
        let ts = current_millis_timestamp();
        Self {
            token: md5_hex(&format!("{ts}{JM_API_VERSION}")),
            tokenparam: format!("{ts},{JM_API_VERSION}"),
            ts,
        }
    }
}

fn cached_manifest(cache_key: &str) -> Option<ReaderManifest> {
    MANIFEST_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .ok()
        .and_then(|cache| cache.get(cache_key).cloned())
}

fn cache_manifest(cache_key: String, manifest: ReaderManifest) {
    if let Ok(mut cache) = MANIFEST_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
    {
        cache.insert(cache_key, manifest);
    }
}

pub(crate) fn clear_manifest_cache() {
    if let Ok(mut cache) = MANIFEST_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
    {
        cache.clear();
    }
}

fn manifest_cache_key(endpoint: &str, read_id: &str) -> String {
    format!("{endpoint}|{read_id}")
}

fn normalize_read_id(read_id: String) -> ApiResult<String> {
    let read_id = read_id.trim().to_string();

    if read_id.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Reader needs a read_id",
        ));
    }

    Ok(read_id)
}

fn page_name_from_image(image: &str) -> String {
    let image = image.split('?').next().unwrap_or(image);
    image
        .rsplit('/')
        .next()
        .unwrap_or(image)
        .rsplit_once('.')
        .map(|(name, _)| name.to_string())
        .unwrap_or_else(|| image.to_string())
}

fn reader_response_preview(value: &str) -> String {
    value
        .chars()
        .take(180)
        .collect::<String>()
        .replace('\n', "\\n")
}

fn current_millis_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn android_user_agent() -> &'static str {
    "Mozilla/5.0 (Linux; Android 13; jm-boom Build/TQ1A.230305.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36"
}

pub(crate) fn url_host(url: &str) -> String {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_default()
}

fn decode_plugin_payload<T>(body: &str, ts: &str) -> ApiResult<T>
where
    T: DeserializeOwned,
{
    let envelope: ReaderApiEnvelope = serde_json::from_str(body).map_err(|error| {
        ApiError::new(
            ApiErrorKind::Payload,
            format!(
                "Invalid plugin envelope: {error}. Body starts with: {}",
                reader_response_preview(body)
            ),
        )
    })?;

    if envelope.code != 200 {
        return Err(ApiError::new(
            ApiErrorKind::Api,
            envelope
                .error_msg
                .unwrap_or_else(|| format!("API returned code {}", envelope.code)),
        ));
    }

    let data = envelope.data.ok_or_else(|| {
        ApiError::new(
            ApiErrorKind::MissingData,
            "API response did not include data",
        )
    })?;

    match data {
        serde_json::Value::String(encrypted) => {
            let decrypted = decrypt_plugin_data(&encrypted, ts)
                .map_err(|error| ApiError::new(ApiErrorKind::Decrypt, error))?;
            serde_json::from_str(&decrypted).map_err(|error| {
                ApiError::new(
                    ApiErrorKind::Payload,
                    format!(
                        "Invalid decrypted payload: {error}. Payload starts with: {}",
                        reader_response_preview(&decrypted)
                    ),
                )
            })
        }
        value => serde_json::from_value(value).map_err(|error| {
            ApiError::new(ApiErrorKind::Payload, format!("Invalid payload: {error}"))
        }),
    }
}

fn decrypt_plugin_data(data: &str, ts: &str) -> Result<String, String> {
    let key = md5_hex(&format!("{ts}{JM_API_SECRET}"));
    decrypt_base64_with_key(data, &key)
}

fn decrypt_base64_with_key(data: &str, key: &str) -> Result<String, String> {
    let encrypted = BASE64_STANDARD
        .decode(data)
        .map_err(|error| format!("Invalid encrypted data: {error}"))?;
    let decrypted = ecb::Decryptor::<Aes256>::new_from_slice(key.as_bytes())
        .map_err(|error| format!("Invalid AES key: {error}"))?
        .decrypt_padded_vec_mut::<Pkcs7>(&encrypted)
        .map_err(|error| format!("Failed to decrypt response: {error}"))?;

    String::from_utf8(decrypted).map_err(|error| format!("Invalid decrypted text: {error}"))
}

fn md5_hex(input: &str) -> String {
    format!("{:x}", md5::compute(input))
}
