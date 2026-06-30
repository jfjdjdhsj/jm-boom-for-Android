use aes::Aes256;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use ecb::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyInit};

use crate::api::{ApiError, ApiErrorKind, ApiResult, SavedLoginConfig};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

use super::pool;

const CREDENTIAL_CRYPTO_SEED: &str = "jm-boom-local-auto-login-v1";

pub(crate) struct SavedLoginCredentials {
    pub(crate) endpoint: String,
    pub(crate) username: String,
    pub(crate) password: String,
    pub(crate) auto_login: bool,
}

pub(crate) async fn load_saved_login_credentials() -> ApiResult<Option<SavedLoginCredentials>> {
    let pool = pool().map_err(|error| ApiError::new(ApiErrorKind::Cache, error))?;
    let row = sqlx::query(
        r#"
        SELECT endpoint, username_cipher, password_cipher, auto_login
        FROM saved_login_credentials
        WHERE id = 1
        "#,
    )
    .fetch_optional(pool)
    .await
    .map_err(map_sqlx_error)?;

    let Some(row) = row else {
        return Ok(None);
    };

    let endpoint: String = row.get("endpoint");
    let username_cipher: String = row.get("username_cipher");
    let password_cipher: String = row.get("password_cipher");
    let auto_login: i64 = row.get("auto_login");

    Ok(Some(SavedLoginCredentials {
        endpoint,
        username: decrypt_credential(&username_cipher)?,
        password: decrypt_credential(&password_cipher)?,
        auto_login: auto_login != 0,
    }))
}

pub(crate) async fn load_saved_login_config() -> ApiResult<Option<SavedLoginConfig>> {
    load_saved_login_credentials()
        .await
        .map(|credentials| credentials.map(saved_credentials_to_config))
}

pub(crate) async fn save_login_credentials(
    endpoint: &str,
    username: &str,
    password: &str,
    auto_login: bool,
) -> ApiResult<SavedLoginConfig> {
    let pool = pool().map_err(|error| ApiError::new(ApiErrorKind::Cache, error))?;
    let endpoint = endpoint.trim();
    let username = username.trim();
    let password = password.trim();

    if endpoint.is_empty() || username.is_empty() || password.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Saved login needs endpoint, username and password",
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO saved_login_credentials (
            id, endpoint, username_cipher, password_cipher, auto_login, updated_at
        )
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            endpoint = excluded.endpoint,
            username_cipher = excluded.username_cipher,
            password_cipher = excluded.password_cipher,
            auto_login = excluded.auto_login,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(endpoint)
    .bind(encrypt_credential(username)?)
    .bind(encrypt_credential(password)?)
    .bind(if auto_login { 1_i64 } else { 0_i64 })
    .bind(current_timestamp())
    .execute(pool)
    .await
    .map_err(map_sqlx_error)?;

    Ok(SavedLoginConfig {
        endpoint: endpoint.to_string(),
        username: username.to_string(),
        auto_login,
        has_password: true,
    })
}

pub(crate) async fn clear_login_credentials() -> ApiResult<()> {
    let pool = pool().map_err(|error| ApiError::new(ApiErrorKind::Cache, error))?;
    sqlx::query("DELETE FROM saved_login_credentials WHERE id = 1")
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(map_sqlx_error)
}

fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().min(i64::MAX as u64) as i64)
        .unwrap_or_default()
}

fn saved_credentials_to_config(credentials: SavedLoginCredentials) -> SavedLoginConfig {
    SavedLoginConfig {
        endpoint: credentials.endpoint,
        username: credentials.username,
        auto_login: credentials.auto_login,
        has_password: !credentials.password.is_empty(),
    }
}

fn encrypt_credential(value: &str) -> ApiResult<String> {
    let key = credential_key();
    let encrypted = ecb::Encryptor::<Aes256>::new_from_slice(key.as_bytes())
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?
        .encrypt_padded_vec_mut::<Pkcs7>(value.as_bytes());

    Ok(BASE64_STANDARD.encode(encrypted))
}

fn decrypt_credential(value: &str) -> ApiResult<String> {
    let key = credential_key();
    let encrypted = BASE64_STANDARD.decode(value).map_err(|error| {
        ApiError::new(
            ApiErrorKind::Decrypt,
            format!("Invalid saved credential payload: {error}"),
        )
    })?;
    let decrypted = ecb::Decryptor::<Aes256>::new_from_slice(key.as_bytes())
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?
        .decrypt_padded_vec_mut::<Pkcs7>(&encrypted)
        .map_err(|error| {
            ApiError::new(
                ApiErrorKind::Decrypt,
                format!("Failed to decrypt saved credential: {error}"),
            )
        })?;

    String::from_utf8(decrypted).map_err(|error| {
        ApiError::new(
            ApiErrorKind::Decrypt,
            format!("Invalid saved credential text: {error}"),
        )
    })
}

fn credential_key() -> String {
    format!("{:x}", md5::compute(CREDENTIAL_CRYPTO_SEED))
}

fn map_sqlx_error(error: sqlx::Error) -> ApiError {
    ApiError::new(ApiErrorKind::Cache, format!("SQLite session error: {error}"))
}
