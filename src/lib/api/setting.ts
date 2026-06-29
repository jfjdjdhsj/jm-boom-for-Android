import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'

export type RemoteSettingParams = {
  endpoint?: string | null
}

export type RemoteSetting = {
  endpoint: string
  imgHost: string
}

export type ApiEndpointProbe = {
  endpoint: string
  available: boolean
  latencyMs: number | null
  imgHost: string | null
  error: string | null
}

export type NetworkProxyMode = 'off' | 'http' | 'socks5'

export type AppUpdateCheckResult = {
  currentVersion: string
  available: boolean
  version: string | null
  notes: string | null
  pubDate: string | null
}

export async function getRemoteSetting({
  endpoint = null
}: RemoteSettingParams = {}): Promise<RemoteSetting> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('Remote setting needs the Tauri desktop runtime.')
  }

  return invoke<RemoteSetting>('get_remote_setting', { endpoint })
}

export async function discoverApiEndpoints(): Promise<ApiEndpointProbe[]> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('API endpoint discovery needs the Tauri desktop runtime.')
  }

  return invoke<ApiEndpointProbe[]>('discover_api_endpoints')
}

export async function configureNetworkProxy({
  mode,
  host,
  port
}: {
  mode: NetworkProxyMode
  host: string
  port: number
}): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    return
  }

  return invoke('configure_network_proxy', { mode, host, port })
}

export async function getCurrentAppVersion(): Promise<string> {
  if (!('__TAURI_INTERNALS__' in window)) {
    return ''
  }

  return getVersion()
}

export async function checkAppUpdate(): Promise<AppUpdateCheckResult> {
  if (!('__TAURI_INTERNALS__' in window)) {
    return {
      currentVersion: '',
      available: false,
      version: null,
      notes: null,
      pubDate: null
    }
  }

  return invoke<AppUpdateCheckResult>('check_app_update')
}

export async function installAppUpdate(): Promise<boolean> {
  if (!('__TAURI_INTERNALS__' in window)) {
    return false
  }

  return invoke<boolean>('install_app_update')
}
