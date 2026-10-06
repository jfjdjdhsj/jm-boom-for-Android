import { getVersion } from '@tauri-apps/api/app'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { hasTauriRuntime, tauriInvoke } from './tauri'

export const APP_UPDATE_PROGRESS_EVENT = 'app-update-download-progress'

/** auto 表示跟随当前设备架构自动选择安装包 */
export const APP_UPDATE_ABIS = [
  'auto',
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86'
] as const

export type AppUpdateAbi = (typeof APP_UPDATE_ABIS)[number]

export const APP_UPDATE_ABI_LABELS: Record<AppUpdateAbi, string> = {
  auto: '自动识别',
  'arm64-v8a': 'arm64-v8a（64 位）',
  'armeabi-v7a': 'armeabi-v7a（32 位）',
  x86_64: 'x86_64（模拟器）',
  x86: 'x86（模拟器）'
}

export const PROJECT_REPO_URL = 'https://github.com/jfjdjdhsj/jm-boom-for-Android'
export const PROJECT_RELEASE_URL = `${PROJECT_REPO_URL}/releases/latest`

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
  manualInstallUrl: string | null
}

export type AppUpdateDownloadProgress = {
  downloaded: number
  total: number
  percent: number
}

export type AppUpdateDownloadResult = {
  version: string
  path: string
}

export type DiagnosticsInfo = {
  logDir: string
  debugLoggingEnabled: boolean
}

export async function getRemoteSetting({
  endpoint = null
}: RemoteSettingParams = {}): Promise<RemoteSetting> {
  return tauriInvoke<RemoteSetting>(
    'get_remote_setting',
    { endpoint },
    'Remote setting needs the Tauri app runtime.'
  )
}

export async function discoverApiEndpoints(): Promise<ApiEndpointProbe[]> {
  return tauriInvoke<ApiEndpointProbe[]>(
    'discover_api_endpoints',
    undefined,
    'API endpoint discovery needs the Tauri app runtime.'
  )
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
  if (!hasTauriRuntime()) {
    return
  }

  return tauriInvoke<void>('configure_network_proxy', { mode, host, port })
}

export async function getCurrentAppVersion(): Promise<string> {
  if (!hasTauriRuntime()) {
    return ''
  }

  return getVersion()
}

export async function checkAppUpdate({
  force = false
}: {
  force?: boolean
} = {}): Promise<AppUpdateCheckResult> {
  if (!hasTauriRuntime()) {
    return {
      currentVersion: '',
      available: false,
      version: null,
      notes: null,
      pubDate: null,
      manualInstallUrl: null
    }
  }

  return tauriInvoke<AppUpdateCheckResult>('check_app_update', { force })
}

export async function downloadAppUpdate({
  version,
  abi
}: {
  version: string
  abi?: AppUpdateAbi | null
}): Promise<AppUpdateDownloadResult> {
  if (!hasTauriRuntime()) {
    throw new Error('Downloading updates needs the Tauri app runtime.')
  }

  return tauriInvoke<AppUpdateDownloadResult>('download_app_update', { version, abi })
}

export async function installAppUpdate({
  path
}: {
  path?: string
} = {}): Promise<boolean> {
  if (!hasTauriRuntime()) {
    return false
  }

  return tauriInvoke<boolean>('install_app_update', { path })
}

export async function listenAppUpdateProgress(
  handler: (progress: AppUpdateDownloadProgress) => void
): Promise<UnlistenFn> {
  if (!hasTauriRuntime()) {
    return () => {}
  }

  return listen<AppUpdateDownloadProgress>(APP_UPDATE_PROGRESS_EVENT, event => {
    handler(event.payload)
  })
}

export function isAndroidRuntime() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

export async function getDiagnosticsInfo(): Promise<DiagnosticsInfo> {
  if (!hasTauriRuntime()) {
    return emptyDiagnosticsInfo()
  }

  return tauriInvoke<DiagnosticsInfo>('get_diagnostics_info')
}

export async function openDiagnosticsLogDir(): Promise<void> {
  if (!hasTauriRuntime()) {
    return
  }

  return tauriInvoke<void>('open_diagnostics_log_dir')
}

export async function setDiagnosticsDebugLogging(enabled: boolean): Promise<DiagnosticsInfo> {
  if (!hasTauriRuntime()) {
    return {
      ...emptyDiagnosticsInfo(),
      debugLoggingEnabled: enabled
    }
  }

  return tauriInvoke<DiagnosticsInfo>('set_diagnostics_debug_logging', { enabled })
}

function emptyDiagnosticsInfo(): DiagnosticsInfo {
  return {
    logDir: '',
    debugLoggingEnabled: import.meta.env.DEV
  }
}
