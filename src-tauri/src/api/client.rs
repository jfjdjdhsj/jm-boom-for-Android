use super::*;

pub fn clear_session() {
    if let Some(jwt_token) = JWT_TOKEN.get() {
        if let Ok(mut jwt_token) = jwt_token.lock() {
            *jwt_token = None;
        }
    }
}

pub fn configure_network_proxy(
    mode: String,
    host: Option<String>,
    port: Option<u16>,
) -> ApiResult<()> {
    let next_config = normalize_network_proxy_config(mode, host, port)?;
    let proxy_config =
        NETWORK_PROXY_CONFIG.get_or_init(|| Mutex::new(NetworkProxyConfig::default()));
    let mut proxy_config = proxy_config
        .lock()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?;

    if *proxy_config == next_config {
        return Ok(());
    }

    *proxy_config = next_config;
    reset_http_client()?;

    Ok(())
}

pub(crate) fn build_http_client() -> ApiResult<reqwest::Client> {
    let client = SHARED_HTTP_CLIENT.get_or_init(|| Mutex::new(None));
    let mut client = client
        .lock()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?;

    if let Some(client) = client.as_ref() {
        return Ok(client.clone());
    }

    let next_client = create_http_client()?;
    *client = Some(next_client.clone());

    Ok(next_client)
}

pub(crate) fn create_http_client() -> ApiResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(8));

    if let Some(proxy_url) = current_proxy_url()? {
        let proxy = reqwest::Proxy::all(&proxy_url).map_err(|error| {
            ApiError::new(
                ApiErrorKind::Client,
                format!("Invalid proxy {proxy_url}: {error}"),
            )
        })?;
        builder = builder.proxy(proxy);
    }

    builder
        .build()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))
}

pub(crate) fn reset_http_client() -> ApiResult<()> {
    let client = SHARED_HTTP_CLIENT.get_or_init(|| Mutex::new(None));
    let mut client = client
        .lock()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?;
    *client = None;

    Ok(())
}

pub(crate) fn set_jwt_token(token: Option<&str>) -> ApiResult<()> {
    let token = token
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(str::to_string);
    let jwt_token = JWT_TOKEN.get_or_init(|| Mutex::new(None));
    let mut jwt_token = jwt_token
        .lock()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?;

    *jwt_token = token;

    Ok(())
}

pub(crate) fn current_jwt_token() -> ApiResult<Option<String>> {
    let jwt_token = JWT_TOKEN.get_or_init(|| Mutex::new(None));
    jwt_token
        .lock()
        .map(|token| token.clone())
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))
}

pub(crate) trait JmRequestBuilderExt {
    fn with_jm_headers(
        self,
        url: &str,
        auth: &ApiAuth,
        use_jwt: bool,
    ) -> ApiResult<reqwest::RequestBuilder>;
}

impl JmRequestBuilderExt for reqwest::RequestBuilder {
    fn with_jm_headers(
        self,
        url: &str,
        auth: &ApiAuth,
        use_jwt: bool,
    ) -> ApiResult<reqwest::RequestBuilder> {
        let builder = self
            .header("accept", "application/json")
            .header("token", &auth.token)
            .header("tokenparam", &auth.tokenparam)
            .header("user-agent", android_user_agent());
        let builder = if let Some(host) = request_url_host(url) {
            builder.header("Host", host)
        } else {
            builder
        };
        let builder = if use_jwt {
            if let Some(jwt) = current_jwt_token()? {
                builder.header("Authorization", format!("Bearer {jwt}"))
            } else {
                builder
            }
        } else {
            builder
        };

        Ok(builder)
    }
}

pub(crate) fn normalize_network_proxy_config(
    mode: String,
    host: Option<String>,
    port: Option<u16>,
) -> ApiResult<NetworkProxyConfig> {
    let default_config = NetworkProxyConfig::default();
    let mode = match mode.trim().to_ascii_lowercase().as_str() {
        "" | "off" | "none" | "disabled" => NetworkProxyMode::Off,
        "http" | "https" => NetworkProxyMode::Http,
        "socks" | "socks5" => NetworkProxyMode::Socks5,
        value => {
            return Err(ApiError::new(
                ApiErrorKind::UnsupportedEndpoint,
                format!("Unsupported proxy mode: {value}"),
            ));
        }
    };

    if mode == NetworkProxyMode::Off {
        return Ok(default_config);
    }

    let host = host
        .unwrap_or(default_config.host)
        .trim()
        .trim_end_matches('/')
        .to_string();
    let port = port.unwrap_or(default_config.port);

    if host.is_empty() {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Proxy host is required",
        ));
    }

    if port == 0 {
        return Err(ApiError::new(
            ApiErrorKind::MissingData,
            "Proxy port must be greater than 0",
        ));
    }

    Ok(NetworkProxyConfig { mode, host, port })
}

pub(crate) fn current_proxy_url() -> ApiResult<Option<String>> {
    let proxy_config =
        NETWORK_PROXY_CONFIG.get_or_init(|| Mutex::new(NetworkProxyConfig::default()));
    let proxy_config = proxy_config
        .lock()
        .map_err(|error| ApiError::new(ApiErrorKind::Client, error.to_string()))?
        .clone();

    let scheme = match proxy_config.mode {
        NetworkProxyMode::Off => return Ok(None),
        NetworkProxyMode::Http => "http",
        NetworkProxyMode::Socks5 => "socks5h",
    };
    let host = if proxy_config.host.contains(':')
        && !proxy_config.host.starts_with('[')
        && !proxy_config.host.ends_with(']')
    {
        format!("[{}]", proxy_config.host)
    } else {
        proxy_config.host
    };

    Ok(Some(format!("{scheme}://{host}:{}", proxy_config.port)))
}
