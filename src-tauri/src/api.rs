use aes::Aes256;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use ecb::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyInit};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

type Aes256EcbDec = ecb::Decryptor<Aes256>;
pub(crate) type ApiResult<T> = Result<T, ApiError>;

const API_VERSION: &str = "1.8.2";
const API_SECRET: &str = "185Hcomic3PAPP7R";
const DEFAULT_API_ENDPOINT: &str = API_ENDPOINTS[0];
const API_ENDPOINTS: [&str; 5] = [
    "https://www.cdnhth.club",
    "https://www.cdnmhwscc.vip",
    "https://www.jmapiproxyxxx.vip",
    "https://www.cdnxxx-proxy.xyz",
    "https://www.jmeadpoolcdn.life",
];
static IMG_HOST_CACHE: OnceLock<Mutex<HashMap<&'static str, String>>> = OnceLock::new();

#[derive(Debug)]
pub enum ApiErrorKind {
    Api,
    Cache,
    Client,
    Decode,
    Decrypt,
    Empty,
    Http,
    MissingData,
    Network,
    Payload,
    UnsupportedEndpoint,
}

#[derive(Debug)]
pub struct ApiError {
    kind: ApiErrorKind,
    message: String,
}

impl ApiError {
    pub(crate) fn new(kind: ApiErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for ApiError {}

#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    code: i32,
    data: Option<T>,
    #[serde(rename = "errorMsg")]
    error_msg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchPayload {
    search_query: String,
    #[serde(deserialize_with = "deserialize_u32_from_string_or_number")]
    total: u32,
    redirect_aid: Option<String>,
    content: Vec<SearchContentItem>,
}

#[derive(Debug, Deserialize)]
struct SearchContentItem {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    author: String,
    description: Option<String>,
    name: String,
    image: String,
    category: Option<SearchCategory>,
    category_sub: Option<SearchCategory>,
    #[serde(
        default,
        deserialize_with = "deserialize_optional_i64_from_string_or_number"
    )]
    update_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SearchCategory {
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ComicListItemPayload {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    author: String,
    description: Option<String>,
    name: String,
    image: String,
    category: Option<SearchCategory>,
    category_sub: Option<SearchCategory>,
    #[serde(
        default,
        deserialize_with = "deserialize_optional_i64_from_string_or_number"
    )]
    update_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct HomeFeedSectionPayload {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    title: String,
    slug: String,
    #[serde(rename = "type")]
    section_type: String,
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    filter_val: String,
    content: Vec<ComicListItemPayload>,
}

#[derive(Debug, Deserialize)]
struct WeekPayload {
    categories: Vec<WeekCategoryPayload>,
    #[serde(rename = "type")]
    types: Vec<WeekTypePayload>,
}

#[derive(Debug, Deserialize)]
struct WeekCategoryPayload {
    id: String,
    time: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct WeekTypePayload {
    id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct WeekComicsPayload {
    #[serde(deserialize_with = "deserialize_u32_from_string_or_number")]
    total: u32,
    list: Vec<ComicListItemPayload>,
}

#[derive(Debug, Deserialize)]
struct ComicDetailPayload {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default, deserialize_with = "deserialize_string_vec_from_any")]
    author: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    total_views: u32,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    likes: u32,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    comment_total: u32,
    #[serde(default, deserialize_with = "deserialize_string_vec_from_any")]
    tags: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_string_vec_from_any")]
    actors: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_string_vec_from_any")]
    works: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_bool_from_any")]
    is_favorite: bool,
    #[serde(default, deserialize_with = "deserialize_bool_from_any")]
    liked: bool,
    #[serde(default)]
    related_list: Vec<ComicDetailRelatedPayload>,
    #[serde(default)]
    series: Vec<ComicDetailSeriesPayload>,
    #[serde(default, deserialize_with = "deserialize_string_from_any")]
    series_id: String,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    price: u32,
    #[serde(default, deserialize_with = "deserialize_bool_from_any")]
    purchased: bool,
}

#[derive(Debug, Deserialize)]
struct ComicDetailRelatedPayload {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    name: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    image: String,
}

#[derive(Debug, Deserialize)]
struct ComicDetailSeriesPayload {
    #[serde(deserialize_with = "deserialize_string_from_string_or_number")]
    id: String,
    name: String,
    #[serde(default, deserialize_with = "deserialize_string_from_any")]
    sort: String,
}

#[derive(Debug, Deserialize)]
struct CommentListPayload {
    #[serde(default)]
    list: Vec<CommentPayload>,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    total: u32,
}

#[derive(Debug, Deserialize)]
struct CommentPayload {
    #[serde(
        default,
        rename = "AID",
        deserialize_with = "deserialize_optional_string_from_any"
    )]
    aid: Option<String>,
    #[serde(
        default,
        rename = "CID",
        deserialize_with = "deserialize_string_from_any"
    )]
    cid: String,
    #[serde(
        default,
        rename = "UID",
        deserialize_with = "deserialize_string_from_any"
    )]
    uid: String,
    #[serde(default)]
    username: String,
    #[serde(default)]
    nickname: String,
    #[serde(default, deserialize_with = "deserialize_u32_from_any")]
    likes: u32,
    #[serde(default)]
    update_at: String,
    #[serde(default)]
    addtime: String,
    #[serde(
        default,
        rename = "parent_CID",
        deserialize_with = "deserialize_string_from_any"
    )]
    parent_cid: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    photo: String,
    #[serde(default, deserialize_with = "deserialize_bool_from_any")]
    spoiler: bool,
    #[serde(default)]
    replys: Option<Vec<CommentPayload>>,
}

#[derive(Debug, Deserialize)]
struct RemoteSettingPayload {
    img_host: String,
}

#[derive(Debug, Serialize)]
pub struct RemoteSettingResult {
    pub endpoint: String,
    #[serde(rename = "imgHost")]
    pub img_host: String,
}

#[derive(Debug, Serialize)]
pub struct SearchAlbumsResult {
    pub query: String,
    pub page: u32,
    pub total: u32,
    pub endpoint: Option<String>,
    #[serde(rename = "redirectAid")]
    pub redirect_aid: Option<String>,
    pub items: Vec<SearchAlbum>,
}

#[derive(Debug, Serialize)]
pub struct SearchAlbum {
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub image: String,
    pub tags: Vec<String>,
    pub href: String,
    pub updated_at: Option<i64>,
    #[serde(rename = "isRedirect")]
    pub is_redirect: bool,
}

#[derive(Debug, Serialize)]
pub struct HomeFeedResult {
    pub endpoint: String,
    pub sections: Vec<HomeFeedSection>,
}

#[derive(Debug, Serialize)]
pub struct HomeFeedSection {
    pub id: String,
    pub title: String,
    pub slug: String,
    #[serde(rename = "type")]
    pub section_type: String,
    #[serde(rename = "filterValue")]
    pub filter_value: String,
    pub items: Vec<FeedComic>,
}

#[derive(Debug, Serialize)]
pub struct WeekFiltersResult {
    pub endpoint: String,
    pub categories: Vec<WeekCategory>,
    pub types: Vec<WeekType>,
    #[serde(rename = "defaultCategoryId")]
    pub default_category_id: Option<String>,
    #[serde(rename = "defaultTypeId")]
    pub default_type_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WeekItemsResult {
    pub endpoint: String,
    pub page: u32,
    pub total: u32,
    pub items: Vec<FeedComic>,
}

#[derive(Debug, Serialize)]
pub struct ComicDetailResult {
    pub endpoint: String,
    pub comic: ComicDetail,
}

#[derive(Debug, Serialize)]
pub struct ComicDetail {
    pub id: String,
    pub title: String,
    pub author: Vec<String>,
    pub description: String,
    #[serde(rename = "totalViews")]
    pub total_views: u32,
    pub likes: u32,
    #[serde(rename = "commentTotal")]
    pub comment_total: u32,
    pub tags: Vec<String>,
    pub actors: Vec<String>,
    pub works: Vec<String>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
    pub liked: bool,
    #[serde(rename = "relatedList")]
    pub related_list: Vec<RelatedComic>,
    pub series: Vec<ComicChapter>,
    #[serde(rename = "seriesId")]
    pub series_id: String,
    pub price: u32,
    pub purchased: bool,
    pub image: String,
}

#[derive(Debug, Serialize)]
pub struct RelatedComic {
    pub id: String,
    pub title: String,
    pub author: String,
    pub image: String,
}

#[derive(Debug, Serialize)]
pub struct ComicChapter {
    pub id: String,
    pub title: String,
    pub sort: String,
}

#[derive(Debug, Serialize)]
pub struct ComicCommentsResult {
    pub endpoint: String,
    pub page: u32,
    pub total: u32,
    pub comments: Vec<ComicComment>,
}

#[derive(Debug, Serialize)]
pub struct ComicComment {
    pub id: String,
    #[serde(rename = "comicId")]
    pub comic_id: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub username: String,
    pub nickname: String,
    pub content: String,
    #[serde(rename = "likeCount")]
    pub like_count: u32,
    pub time: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub avatar: String,
    #[serde(rename = "parentId")]
    pub parent_id: String,
    pub spoiler: bool,
    pub replies: Vec<ComicComment>,
}

#[derive(Debug, Serialize)]
pub struct WeekCategory {
    pub id: String,
    pub time: String,
    pub title: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct WeekType {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct FeedComic {
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub image: String,
    pub tags: Vec<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<i64>,
}

pub(crate) struct ApiAuth {
    pub(crate) ts: u64,
    pub(crate) token: String,
    pub(crate) tokenparam: String,
}

impl ApiAuth {
    pub(crate) fn current() -> Self {
        let ts = current_timestamp();

        Self {
            ts,
            token: md5_hex(&format!("{ts}{API_SECRET}")),
            tokenparam: format!("{ts},{API_VERSION}"),
        }
    }
}

pub async fn get_remote_setting(endpoint: Option<String>) -> ApiResult<RemoteSettingResult> {
    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host = request_remote_img_host(&client, endpoint, &auth).await?;

    Ok(RemoteSettingResult {
        endpoint: endpoint.to_string(),
        img_host,
    })
}

pub async fn search_comics(
    query: String,
    page: Option<u32>,
    endpoint: Option<String>,
) -> ApiResult<SearchAlbumsResult> {
    let page = page.unwrap_or(1);
    let query = query.trim().to_string();
    let endpoint = resolve_api_endpoint(endpoint)?;

    if query.is_empty() {
        return Ok(SearchAlbumsResult {
            query,
            page,
            total: 0,
            endpoint: None,
            redirect_aid: None,
            items: Vec::new(),
        });
    }

    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host = match request_remote_img_host(&client, endpoint, &auth).await {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            eprintln!("Failed to load remote setting for search covers: {error}");
            None
        }
    };

    request_search(&client, endpoint, &query, page, &auth, img_host.as_deref()).await
}

pub async fn get_home_feed(endpoint: Option<String>) -> ApiResult<HomeFeedResult> {
    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host = match request_remote_img_host(&client, endpoint, &auth).await {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            eprintln!("Failed to load remote setting for home covers: {error}");
            None
        }
    };
    let sections = request_home_feed(&client, endpoint, &auth, img_host.as_deref()).await?;

    Ok(HomeFeedResult {
        endpoint: endpoint.to_string(),
        sections,
    })
}

pub async fn get_week_filters(endpoint: Option<String>) -> ApiResult<WeekFiltersResult> {
    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let week = request_week_data(&client, endpoint, &auth).await?;
    let categories = map_week_categories(week.categories);
    let types = map_week_types(week.types);

    Ok(WeekFiltersResult {
        endpoint: endpoint.to_string(),
        default_category_id: categories.first().map(|item| item.id.clone()),
        default_type_id: types.first().map(|item| item.id.clone()),
        categories,
        types,
    })
}

pub async fn get_week_items(
    page: Option<u32>,
    category_id: String,
    type_id: String,
    endpoint: Option<String>,
) -> ApiResult<WeekItemsResult> {
    let page = page.unwrap_or(1);
    let endpoint = resolve_api_endpoint(endpoint)?;
    let category_id = category_id.trim();
    let type_id = type_id.trim();

    if category_id.is_empty() || type_id.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Week items need both category_id and type_id",
        ));
    }

    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host_future = request_remote_img_host(&client, endpoint, &auth);
    let payload_future = request_week_comics(&client, endpoint, page, category_id, type_id, &auth);
    let (img_host_result, payload_result) = tokio::join!(img_host_future, payload_future);
    let img_host = match img_host_result {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            eprintln!("Failed to load remote setting for weekly covers: {error}");
            None
        }
    };
    let payload = payload_result?;

    Ok(WeekItemsResult {
        endpoint: endpoint.to_string(),
        page,
        total: payload.total,
        items: payload
            .list
            .into_iter()
            .map(|item| map_feed_comic(item, img_host.as_deref()))
            .collect(),
    })
}

pub async fn get_comic_detail(
    comic_id: String,
    endpoint: Option<String>,
) -> ApiResult<ComicDetailResult> {
    let comic_id = comic_id.trim().to_string();

    if comic_id.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Comic detail needs a comic_id",
        ));
    }

    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host_future = request_remote_img_host(&client, endpoint, &auth);
    let payload_future = request_comic_detail(&client, endpoint, &comic_id, &auth);
    let (img_host_result, payload_result) = tokio::join!(img_host_future, payload_future);
    let img_host = match img_host_result {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            eprintln!("Failed to load remote setting for detail images: {error}");
            None
        }
    };

    Ok(ComicDetailResult {
        endpoint: endpoint.to_string(),
        comic: map_comic_detail(payload_result?, img_host.as_deref()),
    })
}

pub async fn get_comic_comments(
    comic_id: String,
    page: Option<u32>,
    endpoint: Option<String>,
) -> ApiResult<ComicCommentsResult> {
    let comic_id = comic_id.trim().to_string();
    let page = page.unwrap_or(1);

    if comic_id.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Comic comments need a comic_id",
        ));
    }

    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let img_host_future = request_remote_img_host(&client, endpoint, &auth);
    let payload_future = request_comic_comments(&client, endpoint, &comic_id, page, &auth);
    let (img_host_result, payload_result) = tokio::join!(img_host_future, payload_future);
    let img_host = match img_host_result {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            eprintln!("Failed to load remote setting for comment avatars: {error}");
            None
        }
    };
    let payload = payload_result?;

    Ok(ComicCommentsResult {
        endpoint: endpoint.to_string(),
        page,
        total: payload.total,
        comments: payload
            .list
            .into_iter()
            .map(|comment| map_comment(comment, img_host.as_deref()))
            .collect(),
    })
}

pub(crate) fn build_http_client() -> ApiResult<reqwest::Client> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))
}

async fn request_remote_setting(
    client: &reqwest::Client,
    endpoint: &str,
    auth: &ApiAuth,
) -> ApiResult<RemoteSettingPayload> {
    request_api_data::<RemoteSettingPayload>(client, endpoint, "setting", &[], auth).await
}

async fn request_remote_img_host(
    client: &reqwest::Client,
    endpoint: &'static str,
    auth: &ApiAuth,
) -> ApiResult<String> {
    if let Some(img_host) = cached_img_host(endpoint) {
        return Ok(img_host);
    }

    let setting = request_remote_setting(client, endpoint, auth).await?;
    cache_img_host(endpoint, &setting.img_host);

    Ok(setting.img_host)
}

fn cached_img_host(endpoint: &'static str) -> Option<String> {
    IMG_HOST_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .ok()
        .and_then(|cache| cache.get(endpoint).cloned())
}

fn cache_img_host(endpoint: &'static str, img_host: &str) {
    if let Ok(mut cache) = IMG_HOST_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
    {
        cache.insert(endpoint, img_host.to_string());
    }
}

async fn request_search(
    client: &reqwest::Client,
    endpoint: &str,
    query: &str,
    page: u32,
    auth: &ApiAuth,
    img_host: Option<&str>,
) -> ApiResult<SearchAlbumsResult> {
    let mut payload: SearchPayload = request_api_data(
        client,
        endpoint,
        "search",
        &[
            ("page", page.to_string()),
            ("o", "mr".to_string()),
            ("search_query", query.to_string()),
        ],
        auth,
    )
    .await?;

    let items = payload
        .content
        .into_iter()
        .map(|item| {
            let mut tags = Vec::new();
            let image = cover_image_url(img_host, &item.id).unwrap_or(item.image);

            if let Some(title) = item.category.and_then(|category| category.title) {
                if !title.is_empty() {
                    tags.push(title);
                }
            }

            if let Some(title) = item.category_sub.and_then(|category| category.title) {
                if !title.is_empty() && !tags.contains(&title) {
                    tags.push(title);
                }
            }

            SearchAlbum {
                href: format!("{endpoint}/album/{}", item.id),
                id: item.id,
                title: item.name,
                author: item.author,
                description: item.description.unwrap_or_default(),
                image,
                tags,
                updated_at: item.update_at,
                is_redirect: false,
            }
        })
        .collect::<Vec<_>>();

    let redirect_aid = payload.redirect_aid.take();
    let items = if items.is_empty() {
        redirect_aid
            .clone()
            .map(|id| {
                vec![SearchAlbum {
                    href: String::new(),
                    id: id.clone(),
                    title: format!("JM{id}"),
                    author: String::new(),
                    description: String::new(),
                    image: String::new(),
                    tags: Vec::new(),
                    updated_at: None,
                    is_redirect: true,
                }]
            })
            .unwrap_or(items)
    } else {
        items
    };

    Ok(SearchAlbumsResult {
        query: payload.search_query,
        page,
        total: payload.total,
        endpoint: Some(endpoint.to_string()),
        redirect_aid,
        items,
    })
}

async fn request_home_feed(
    client: &reqwest::Client,
    endpoint: &str,
    auth: &ApiAuth,
    img_host: Option<&str>,
) -> ApiResult<Vec<HomeFeedSection>> {
    let payload: Vec<HomeFeedSectionPayload> =
        request_api_data(client, endpoint, "promote", &[], auth).await?;

    Ok(payload
        .into_iter()
        .map(|section| HomeFeedSection {
            id: section.id,
            title: section.title,
            slug: section.slug,
            section_type: section.section_type,
            filter_value: section.filter_val,
            items: section
                .content
                .into_iter()
                .map(|item| map_feed_comic(item, img_host))
                .collect(),
        })
        .collect())
}

async fn request_week_data(
    client: &reqwest::Client,
    endpoint: &str,
    auth: &ApiAuth,
) -> ApiResult<WeekPayload> {
    request_api_data(client, endpoint, "week", &[], auth).await
}

async fn request_week_comics(
    client: &reqwest::Client,
    endpoint: &str,
    page: u32,
    category_id: &str,
    type_id: &str,
    auth: &ApiAuth,
) -> ApiResult<WeekComicsPayload> {
    request_api_data(
        client,
        endpoint,
        "week/filter",
        &[
            ("page", page.to_string()),
            ("id", category_id.to_string()),
            ("type", type_id.to_string()),
        ],
        auth,
    )
    .await
}

async fn request_comic_detail(
    client: &reqwest::Client,
    endpoint: &str,
    comic_id: &str,
    auth: &ApiAuth,
) -> ApiResult<ComicDetailPayload> {
    request_api_data(
        client,
        endpoint,
        "album",
        &[("id", comic_id.to_string())],
        auth,
    )
    .await
}

async fn request_comic_comments(
    client: &reqwest::Client,
    endpoint: &str,
    comic_id: &str,
    page: u32,
    auth: &ApiAuth,
) -> ApiResult<CommentListPayload> {
    request_api_data(
        client,
        endpoint,
        "forum",
        &[
            ("page", page.to_string()),
            ("aid", comic_id.to_string()),
            ("mode", "manhua".to_string()),
        ],
        auth,
    )
    .await
}

async fn request_api_data<T>(
    client: &reqwest::Client,
    endpoint: &str,
    path: &str,
    query: &[(&str, String)],
    auth: &ApiAuth,
) -> ApiResult<T>
where
    T: DeserializeOwned,
{
    let request_name = format!("{endpoint}/{path}");
    let url = format!("{endpoint}/{path}");
    let query = query
        .iter()
        .map(|(key, value)| (*key, value.as_str()))
        .collect::<Vec<_>>();

    let response = client
        .get(url)
        .header("accept", "application/json")
        .header("token", &auth.token)
        .header("tokenparam", &auth.tokenparam)
        .query(&query)
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

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = response.text().await.map_err(|error| {
        ApiError::new(ApiErrorKind::Network, format!("{request_name}: {error}"))
    })?;
    let body = body.trim();

    if body.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::Empty,
            format!("{request_name}: API returned an empty response"),
        ));
    }

    let envelope: ApiResponse<serde_json::Value> = serde_json::from_str(body).map_err(|error| {
        ApiError::new(
            ApiErrorKind::Decode,
            format!(
                "{request_name}: Invalid API response ({content_type}): {error}. Body starts with: {}",
                response_preview(body)
            ),
        )
    })?;

    if envelope.code != 200 {
        return Err(ApiError::new(
            ApiErrorKind::Api,
            envelope
                .error_msg
                .map(|message| format!("{request_name}: {message}"))
                .unwrap_or_else(|| format!("{request_name}: API returned code {}", envelope.code)),
        ));
    }

    let data = envelope.data.ok_or_else(|| {
        ApiError::new(
            ApiErrorKind::MissingData,
            format!("{request_name}: API response did not include data"),
        )
    })?;

    match data {
        serde_json::Value::String(encrypted) => {
            let decrypted = decrypt_data(&encrypted, auth.ts).map_err(|error| {
                ApiError::new(ApiErrorKind::Decrypt, format!("{request_name}: {error}"))
            })?;
            serde_json::from_str(&decrypted).map_err(|error| {
                ApiError::new(
                    ApiErrorKind::Payload,
                    format!(
                        "{request_name}: Invalid payload: {error}. Payload starts with: {}",
                        response_preview(&decrypted)
                    ),
                )
            })
        }
        value => serde_json::from_value(value).map_err(|error| {
            ApiError::new(
                ApiErrorKind::Payload,
                format!("{request_name}: Invalid payload: {error}"),
            )
        }),
    }
}

fn map_feed_comic(item: ComicListItemPayload, img_host: Option<&str>) -> FeedComic {
    let mut tags = Vec::new();

    if let Some(title) = item.category.and_then(|category| category.title) {
        if !title.is_empty() {
            tags.push(title);
        }
    }

    if let Some(title) = item.category_sub.and_then(|category| category.title) {
        if !title.is_empty() && !tags.contains(&title) {
            tags.push(title);
        }
    }

    FeedComic {
        image: cover_image_url(img_host, &item.id).unwrap_or(item.image),
        id: item.id,
        title: item.name,
        author: item.author,
        description: item.description.unwrap_or_default(),
        tags,
        updated_at: item.update_at,
    }
}

fn map_comic_detail(payload: ComicDetailPayload, img_host: Option<&str>) -> ComicDetail {
    let image = cover_image_url(img_host, &payload.id).unwrap_or_default();

    ComicDetail {
        id: payload.id,
        title: payload.name,
        author: payload.author,
        description: payload.description,
        total_views: payload.total_views,
        likes: payload.likes,
        comment_total: payload.comment_total,
        tags: payload.tags,
        actors: payload.actors,
        works: payload.works,
        is_favorite: payload.is_favorite,
        liked: payload.liked,
        related_list: payload
            .related_list
            .into_iter()
            .map(|item| map_related_comic(item, img_host))
            .collect(),
        series: payload
            .series
            .into_iter()
            .map(|item| ComicChapter {
                id: item.id,
                title: item.name,
                sort: item.sort,
            })
            .collect(),
        series_id: payload.series_id,
        price: payload.price,
        purchased: payload.purchased,
        image,
    }
}

fn map_related_comic(item: ComicDetailRelatedPayload, img_host: Option<&str>) -> RelatedComic {
    let image = cover_image_url(img_host, &item.id).unwrap_or(item.image);

    RelatedComic {
        id: item.id,
        title: item.name,
        author: item.author,
        image,
    }
}

fn map_comment(payload: CommentPayload, img_host: Option<&str>) -> ComicComment {
    ComicComment {
        id: payload.cid,
        comic_id: payload.aid,
        user_id: payload.uid,
        username: payload.username,
        nickname: payload.nickname,
        content: payload.content,
        like_count: payload.likes,
        time: payload.addtime,
        updated_at: payload.update_at,
        avatar: user_avatar_url(img_host, &payload.photo).unwrap_or_default(),
        parent_id: payload.parent_cid,
        spoiler: payload.spoiler,
        replies: payload
            .replys
            .unwrap_or_default()
            .into_iter()
            .map(|reply| map_comment(reply, img_host))
            .collect(),
    }
}

fn map_week_categories(categories: Vec<WeekCategoryPayload>) -> Vec<WeekCategory> {
    categories
        .into_iter()
        .map(|item| WeekCategory {
            label: if item.time.is_empty() {
                item.title.clone()
            } else {
                format!("{} ({})", item.title, item.time)
            },
            id: item.id,
            time: item.time,
            title: item.title,
        })
        .collect()
}

fn map_week_types(types: Vec<WeekTypePayload>) -> Vec<WeekType> {
    types
        .into_iter()
        .map(|item| WeekType {
            id: item.id,
            title: item.title,
        })
        .collect()
}

fn decrypt_data(data: &str, ts: u64) -> Result<String, String> {
    let encrypted = BASE64_STANDARD
        .decode(data)
        .map_err(|error| format!("Invalid encrypted data: {error}"))?;
    let key = md5_hex(&format!("{ts}{API_SECRET}"));
    let decrypted = Aes256EcbDec::new_from_slice(key.as_bytes())
        .map_err(|error| format!("Invalid AES key: {error}"))?
        .decrypt_padded_vec_mut::<Pkcs7>(&encrypted)
        .map_err(|error| format!("Failed to decrypt response: {error}"))?;

    String::from_utf8(decrypted).map_err(|error| format!("Invalid decrypted text: {error}"))
}

pub(crate) fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn md5_hex(input: &str) -> String {
    format!("{:x}", md5::compute(input))
}

fn deserialize_u32_from_string_or_number<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Number(number) => number
            .as_u64()
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| serde::de::Error::custom("expected a valid u32 number")),
        serde_json::Value::String(value) => value
            .parse::<u32>()
            .map_err(|error| serde::de::Error::custom(format!("expected a u32 string: {error}"))),
        _ => Err(serde::de::Error::custom("expected a u32 number or string")),
    }
}

fn deserialize_u32_from_any<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Number(number) => number
            .as_u64()
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| serde::de::Error::custom("expected a valid u32 number")),
        serde_json::Value::String(value) => {
            let value = value.trim();

            if value.is_empty() {
                return Ok(0);
            }

            Ok(value.parse::<u32>().unwrap_or_default())
        }
        serde_json::Value::Null => Ok(0),
        _ => Err(serde::de::Error::custom("expected a u32-compatible value")),
    }
}

fn deserialize_string_from_string_or_number<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::String(value) => Ok(value),
        serde_json::Value::Number(value) => Ok(value.to_string()),
        _ => Err(serde::de::Error::custom("expected a string or number")),
    }
}

fn deserialize_string_from_any<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::String(value) => Ok(value),
        serde_json::Value::Number(value) => Ok(value.to_string()),
        serde_json::Value::Bool(value) => Ok(value.to_string()),
        serde_json::Value::Null => Ok(String::new()),
        _ => Err(serde::de::Error::custom("expected a scalar value")),
    }
}

fn deserialize_optional_string_from_any<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    let Some(value) = value else {
        return Ok(None);
    };

    match value {
        serde_json::Value::String(value) => {
            if value.trim().is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        serde_json::Value::Number(value) => Ok(Some(value.to_string())),
        serde_json::Value::Bool(value) => Ok(Some(value.to_string())),
        serde_json::Value::Null => Ok(None),
        _ => Err(serde::de::Error::custom(
            "expected an optional scalar value",
        )),
    }
}

fn deserialize_string_vec_from_any<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Array(items) => {
            let values = items
                .into_iter()
                .filter_map(|item| match item {
                    serde_json::Value::String(value) => Some(value),
                    serde_json::Value::Number(value) => Some(value.to_string()),
                    serde_json::Value::Bool(value) => Some(value.to_string()),
                    _ => None,
                })
                .filter(|value| !value.trim().is_empty())
                .collect::<Vec<_>>();

            Ok(values)
        }
        serde_json::Value::String(value) => {
            if value.trim().is_empty() {
                Ok(Vec::new())
            } else {
                Ok(vec![value])
            }
        }
        serde_json::Value::Number(value) => Ok(vec![value.to_string()]),
        serde_json::Value::Null => Ok(Vec::new()),
        _ => Err(serde::de::Error::custom("expected a string list")),
    }
}

fn deserialize_bool_from_any<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Bool(value) => Ok(value),
        serde_json::Value::Number(value) => Ok(value.as_u64().unwrap_or_default() != 0),
        serde_json::Value::String(value) => {
            let value = value.trim().to_ascii_lowercase();

            Ok(matches!(value.as_str(), "1" | "true" | "yes" | "ok"))
        }
        serde_json::Value::Null => Ok(false),
        _ => Err(serde::de::Error::custom("expected a bool-compatible value")),
    }
}

fn deserialize_optional_i64_from_string_or_number<'de, D>(
    deserializer: D,
) -> Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    let Some(value) = value else {
        return Ok(None);
    };

    match value {
        serde_json::Value::Number(number) => number
            .as_i64()
            .map(Some)
            .ok_or_else(|| serde::de::Error::custom("expected a valid i64 number")),
        serde_json::Value::String(value) => {
            if value.trim().is_empty() {
                return Ok(None);
            }

            value.parse::<i64>().map(Some).map_err(|error| {
                serde::de::Error::custom(format!("expected an i64 string: {error}"))
            })
        }
        _ => Err(serde::de::Error::custom("expected an i64 number or string")),
    }
}

pub(crate) fn resolve_api_endpoint(endpoint: Option<String>) -> ApiResult<&'static str> {
    let Some(endpoint) = endpoint else {
        return Ok(DEFAULT_API_ENDPOINT);
    };
    let endpoint = endpoint.trim().trim_end_matches('/');

    if endpoint.is_empty() {
        return Ok(DEFAULT_API_ENDPOINT);
    }

    API_ENDPOINTS
        .iter()
        .copied()
        .find(|candidate| *candidate == endpoint)
        .ok_or_else(|| {
            ApiError::new(
                ApiErrorKind::UnsupportedEndpoint,
                format!("Unsupported API endpoint: {endpoint}"),
            )
        })
}

fn cover_image_url(img_host: Option<&str>, comic_id: &str) -> Option<String> {
    let img_host = img_host?.trim().trim_end_matches('/');

    if img_host.is_empty() {
        return None;
    }

    Some(format!("{img_host}/media/albums/{comic_id}_3x4.jpg"))
}

fn user_avatar_url(img_host: Option<&str>, photo: &str) -> Option<String> {
    let photo = photo.trim();

    if photo.is_empty() {
        return None;
    }

    if photo.starts_with("http://") || photo.starts_with("https://") {
        return Some(photo.to_string());
    }

    let img_host = img_host?.trim().trim_end_matches('/');

    if img_host.is_empty() {
        return None;
    }

    if photo.starts_with('/') {
        Some(format!("{img_host}{photo}"))
    } else {
        Some(format!("{img_host}/media/users/{photo}"))
    }
}

fn response_preview(value: &str) -> String {
    value
        .chars()
        .take(180)
        .collect::<String>()
        .replace('\n', "\\n")
}
