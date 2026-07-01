import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcwIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  checkAppUpdate,
  configureNetworkProxy,
  discoverApiEndpoints,
  getCurrentAppVersion,
  getDiagnosticsInfo,
  installAppUpdate,
  openDiagnosticsLogDir,
  setDiagnosticsDebugLogging
} from '@/lib/api/setting'
import { clearReaderCache, getReaderCacheStats } from '@/lib/api/reader'
import { getSavedLoginConfig, saveLoginCredentials, setLoginAutoLogin } from '@/lib/api/user'
import { queryKeys } from '@/lib/query-keys'
import { useSettingsStore } from '@/stores/settings-store'
import { AccountSection } from './account-section'
import { ApiEndpointSection } from './api-endpoint-section'
import { AppearanceSection } from './appearance-section'
import { CacheSection } from './cache-section'
import { DiagnosticsSection } from './diagnostics-section'
import { PrivacySection } from './privacy-section'
import { ProxySection } from './proxy-section'
import { VersionSection } from './version-section'
import { findPreferredEndpoint, useEndpointOptions } from './use-endpoint-options'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { theme = 'system', setTheme } = useTheme()
  const api = useSettingsStore(state => state.api)
  const readerCacheLimitMb = useSettingsStore(state => state.readerCacheLimitMb)
  const cacheLimitBytes = readerCacheLimitMb * 1024 * 1024
  const proxyMode = useSettingsStore(state => state.proxyMode)
  const proxyHost = useSettingsStore(state => state.proxyHost)
  const proxyPort = useSettingsStore(state => state.proxyPort)
  const hideCovers = useSettingsStore(state => state.hideCovers)
  const setApi = useSettingsStore(state => state.setApi)
  const setReaderCacheLimitMb = useSettingsStore(state => state.setReaderCacheLimitMb)
  const setProxyMode = useSettingsStore(state => state.setProxyMode)
  const setProxyHost = useSettingsStore(state => state.setProxyHost)
  const setProxyPort = useSettingsStore(state => state.setProxyPort)
  const setHideCovers = useSettingsStore(state => state.setHideCovers)
  const reset = useSettingsStore(state => state.reset)
  const endpointDiscovery = useQuery({
    queryKey: queryKeys.apiEndpointDiscovery(),
    queryFn: discoverApiEndpoints,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false
  })
  const [isRefreshingEndpoints, setIsRefreshingEndpoints] = useState(false)
  const endpointOptions = useEndpointOptions(api, endpointDiscovery.data)
  const apiRef = useRef(api)
  const lastPreferredDiscoveryAtRef = useRef(0)
  const readerCacheStats = useQuery({
    queryKey: queryKeys.readerCacheStats(cacheLimitBytes),
    queryFn: () => getReaderCacheStats(cacheLimitBytes),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  })
  const clearCache = useMutation({
    mutationFn: () => clearReaderCache(cacheLimitBytes),
    onSuccess: data => {
      toast.success('阅读缓存已清理')
      queryClient.setQueryData(queryKeys.readerCacheStats(cacheLimitBytes), data)
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const savedLoginConfig = useQuery({
    queryKey: queryKeys.savedLoginConfig(),
    queryFn: getSavedLoginConfig,
    staleTime: 0,
    refetchOnWindowFocus: false
  })
  const saveAccount = useMutation({
    mutationFn: ({
      username,
      password,
      autoLogin
    }: {
      username: string
      password: string
      autoLogin: boolean
    }) => saveLoginCredentials({ username, password, endpoint: api, autoLogin }),
    onSuccess: data => {
      queryClient.setQueryData(queryKeys.savedLoginConfig(), data)
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const setAccountAutoLogin = useMutation({
    mutationFn: setLoginAutoLogin,
    onSuccess: data => {
      if (data) {
        queryClient.setQueryData(queryKeys.savedLoginConfig(), data)
      }
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const diagnosticsInfo = useQuery({
    queryKey: queryKeys.diagnosticsInfo(),
    queryFn: getDiagnosticsInfo,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  })
  const openDiagnosticsDir = useMutation({
    mutationFn: openDiagnosticsLogDir,
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const setDiagnosticsDebug = useMutation({
    mutationFn: setDiagnosticsDebugLogging,
    onSuccess: data => {
      queryClient.setQueryData(queryKeys.diagnosticsInfo(), data)
      toast.success(data.debugLoggingEnabled ? '性能调试日志已开启' : '性能调试日志已关闭')
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const appVersion = useQuery({
    queryKey: queryKeys.appVersion(),
    queryFn: getCurrentAppVersion,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false
  })
  const appUpdate = useQuery({
    queryKey: queryKeys.appUpdate(),
    queryFn: () => checkAppUpdate(),
    enabled: false,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false
  })
  const checkUpdate = useMutation({
    mutationFn: async () => {
      await configureNetworkProxy({ mode: proxyMode, host: proxyHost, port: proxyPort })
      return checkAppUpdate({ force: true })
    },
    onSuccess: data => {
      queryClient.setQueryData(queryKeys.appUpdate(), data)

      if (data.currentVersion) {
        queryClient.setQueryData(queryKeys.appVersion(), data.currentVersion)
      }

      if (data.available) {
        toast.success(`发现新版本 ${data.version}`)
        return
      }

      toast.success('当前已是最新版本')
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })
  const installUpdate = useMutation({
    mutationFn: async () => {
      await configureNetworkProxy({ mode: proxyMode, host: proxyHost, port: proxyPort })
      return installAppUpdate()
    },
    onSuccess: installed => {
      if (!installed) {
        toast.success('当前已是最新版本')
      }
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  })

  useEffect(() => {
    apiRef.current = api
  }, [api])

  useEffect(() => {
    if (
      !endpointDiscovery.data ||
      endpointDiscovery.dataUpdatedAt === 0 ||
      lastPreferredDiscoveryAtRef.current === endpointDiscovery.dataUpdatedAt
    ) {
      return
    }

    lastPreferredDiscoveryAtRef.current = endpointDiscovery.dataUpdatedAt

    const preferredEndpoint = findPreferredEndpoint(endpointDiscovery.data)

    if (preferredEndpoint && apiRef.current !== preferredEndpoint.endpoint) {
      setApi(preferredEndpoint.endpoint)
    }

    setIsRefreshingEndpoints(false)
  }, [endpointDiscovery.data, endpointDiscovery.dataUpdatedAt, setApi])

  function refreshEndpoints() {
    setIsRefreshingEndpoints(true)
    void endpointDiscovery.refetch().catch(() => {
      setIsRefreshingEndpoints(false)
    })
  }

  function resetSettings() {
    reset()
    setTheme('system')
    toast.success('设置已恢复默认')
  }

  return (
    <main className="app-page">
      <div className="app-page-content max-w-5xl space-y-8">
        <PageHeader title="设置" desc="调整 APP 配置和内容显示偏好">
          <Button variant="outline" size="sm" onClick={resetSettings} className="text-xs">
            <RotateCcwIcon className="size-4" />
            恢复默认
          </Button>
        </PageHeader>

        <Card>
          <CardContent className="space-y-8">
            <VersionSection
              currentVersion={
                checkUpdate.data?.currentVersion ||
                appUpdate.data?.currentVersion ||
                appVersion.data ||
                '读取中'
              }
              update={checkUpdate.data ?? appUpdate.data}
              isChecking={checkUpdate.isPending}
              isInstalling={installUpdate.isPending}
              onCheck={() => checkUpdate.mutate()}
              onInstall={() => installUpdate.mutate()}
            />

            <Separator />

            <AppearanceSection theme={theme} onThemeChange={setTheme} />

            <Separator />

            <ApiEndpointSection
              endpoint={api}
              endpointOptions={endpointOptions}
              isDiscovering={endpointDiscovery.isFetching}
              isRefreshingEndpoints={isRefreshingEndpoints}
              onEndpointChange={setApi}
              onRefresh={refreshEndpoints}
            />

            <Separator />

            <ProxySection
              proxyMode={proxyMode}
              proxyHost={proxyHost}
              proxyPort={proxyPort}
              onProxyModeChange={setProxyMode}
              onProxyHostChange={setProxyHost}
              onProxyPortChange={setProxyPort}
            />

            <Separator />

            <CacheSection
              readerCacheLimitMb={readerCacheLimitMb}
              stats={readerCacheStats}
              isClearingCache={clearCache.isPending}
              onCacheLimitChange={setReaderCacheLimitMb}
              onClearCache={() => clearCache.mutate()}
            />

            <Separator />

            <PrivacySection hideCovers={hideCovers} onHideCoversChange={setHideCovers} />

            <Separator />

            <AccountSection
              savedLoginConfig={savedLoginConfig.data}
              isLoading={savedLoginConfig.isLoading}
              isSaving={saveAccount.isPending}
              isSettingAutoLogin={setAccountAutoLogin.isPending}
              onAutoLoginChange={autoLogin => setAccountAutoLogin.mutate(autoLogin)}
              onCredentialsChange={input => saveAccount.mutate(input)}
            />

            <Separator />

            <DiagnosticsSection
              diagnosticsInfo={diagnosticsInfo}
              isOpeningDiagnosticsDir={openDiagnosticsDir.isPending}
              isSettingDebugLogging={setDiagnosticsDebug.isPending}
              onOpenDiagnosticsDir={() => openDiagnosticsDir.mutate()}
              onDebugLoggingChange={enabled => setDiagnosticsDebug.mutate(enabled)}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
