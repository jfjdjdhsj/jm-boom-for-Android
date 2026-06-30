use super::*;

pub async fn login(
    username: String,
    password: String,
    endpoint: Option<String>,
    remember_login: bool,
) -> ApiResult<LoginResult> {
    let username = username.trim().to_string();

    if username.is_empty() || password.trim().is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Login needs both username and password",
        ));
    }

    let endpoint = resolve_api_endpoint(endpoint)?;
    clear_session();
    let client = build_http_client()?;
    let setting_auth = SettingAuth::current();
    let login_auth = ApiAuth::current();
    let img_host_future = request_remote_img_host(&client, &endpoint, &setting_auth);
    let payload_future = request_login(&client, &endpoint, &username, &password, &login_auth);
    let (img_host_result, payload_result) = tokio::join!(img_host_future, payload_future);
    let payload = payload_result?;
    let jwt_token = payload
        .jwttoken
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_string();
    if jwt_token.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Login response did not include a session token",
        ));
    }
    set_jwt_token(Some(&jwt_token))?;
    let img_host = match img_host_result {
        Ok(img_host) => Some(img_host),
        Err(error) => {
            tracing::warn!(error = %error, "failed to load remote setting for user avatar");
            None
        }
    };

    let result = LoginResult {
        endpoint,
        user: map_login_user(payload, img_host.as_deref()),
    };
    if remember_login {
        crate::storage::session::save_login_credentials(
            &result.endpoint,
            &username,
            &password,
            true,
        )
        .await?;
    }

    Ok(result)
}

pub async fn get_current_session() -> ApiResult<Option<LoginResult>> {
    if let Some(credentials) = crate::storage::session::load_saved_login_credentials().await? {
        if credentials.auto_login {
            return login(
                credentials.username,
                credentials.password,
                Some(credentials.endpoint),
                false,
            )
            .await
            .map(Some);
        }
    }

    set_jwt_token(None)?;
    Ok(None)
}

pub async fn clear_stored_session() -> ApiResult<()> {
    clear_session();
    crate::storage::session::clear_login_credentials().await
}

pub async fn get_saved_login_config() -> ApiResult<Option<SavedLoginConfig>> {
    crate::storage::session::load_saved_login_config().await
}

pub async fn save_login_credentials(
    username: String,
    password: String,
    endpoint: Option<String>,
    auto_login: bool,
) -> ApiResult<SavedLoginConfig> {
    let endpoint = resolve_api_endpoint(endpoint)?;
    crate::storage::session::save_login_credentials(&endpoint, &username, &password, auto_login)
        .await
}

pub async fn clear_login_credentials() -> ApiResult<()> {
    crate::storage::session::clear_login_credentials().await
}

pub async fn get_sign_in_data(
    user_id: u32,
    endpoint: Option<String>,
) -> ApiResult<SignInDataResult> {
    if user_id == 0 {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Sign-in data needs a user_id",
        ));
    }

    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let payload = request_sign_in_data(&client, &endpoint, user_id, &auth).await?;

    Ok(SignInDataResult {
        endpoint,
        daily_id: payload.daily_id,
        three_days_coin: payload.three_days_coin,
        three_days_exp: payload.three_days_exp,
        seven_days_coin: payload.seven_days_coin,
        seven_days_exp: payload.seven_days_exp,
        event_name: payload.event_name,
        current_progress: payload.current_progress,
        background_pc: payload.background_pc,
        background_phone: payload.background_phone,
        records: map_sign_in_records(payload.record),
    })
}

pub async fn sign_in(
    user_id: u32,
    daily_id: u32,
    endpoint: Option<String>,
) -> ApiResult<SignInResult> {
    if user_id == 0 || daily_id == 0 {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Sign-in needs both user_id and daily_id",
        ));
    }

    let endpoint = resolve_api_endpoint(endpoint)?;
    let client = build_http_client()?;
    let auth = ApiAuth::current();
    let payload = request_sign_in(&client, &endpoint, user_id, daily_id, &auth).await?;

    Ok(SignInResult {
        endpoint,
        message: payload.msg,
    })
}

pub(crate) async fn request_login(
    client: &reqwest::Client,
    endpoint: &str,
    username: &str,
    password: &str,
    auth: &ApiAuth,
) -> ApiResult<LoginPayload> {
    request_api_form_data_with_jwt(
        client,
        endpoint,
        "login",
        vec![
            ("username".to_string(), username.to_string()),
            ("password".to_string(), password.to_string()),
        ],
        auth,
        false,
    )
    .await
}

pub(crate) async fn request_sign_in_data(
    client: &reqwest::Client,
    endpoint: &str,
    user_id: u32,
    auth: &ApiAuth,
) -> ApiResult<SignInDataPayload> {
    request_api_data(
        client,
        endpoint,
        "daily",
        &[("user_id", user_id.to_string())],
        auth,
    )
    .await
}

pub(crate) async fn request_sign_in(
    client: &reqwest::Client,
    endpoint: &str,
    user_id: u32,
    daily_id: u32,
    auth: &ApiAuth,
) -> ApiResult<SignInPayload> {
    request_api_form_data(
        client,
        endpoint,
        "daily_chk",
        vec![
            ("user_id".to_string(), user_id.to_string()),
            ("daily_id".to_string(), daily_id.to_string()),
        ],
        auth,
    )
    .await
}
