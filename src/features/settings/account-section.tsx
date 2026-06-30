import { KeyRoundIcon, LoaderCircleIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { SavedLoginConfig } from '@/lib/api/user'
import { SettingRow, SettingsSection } from './shared'

export function AccountSection({
  savedLoginConfig,
  isLoading,
  isSaving,
  isClearing,
  onSave,
  onClear
}: {
  savedLoginConfig: SavedLoginConfig | null | undefined
  isLoading: boolean
  isSaving: boolean
  isClearing: boolean
  onSave: (input: { username: string; password: string; autoLogin: boolean }) => void
  onClear: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [autoLogin, setAutoLogin] = useState(true)

  useEffect(() => {
    setUsername(savedLoginConfig?.username ?? '')
    setPassword('')
    setAutoLogin(savedLoginConfig?.autoLogin ?? true)
  }, [savedLoginConfig])

  const isBusy = isLoading || isSaving || isClearing
  const canSave = username.trim().length > 0 && password.trim().length > 0

  return (
    <SettingsSection icon={<KeyRoundIcon className="size-4" />} title="账号">
      <SettingRow title="自动登录配置" description={accountDescription(savedLoginConfig)}>
        <div className="grid w-[420px] grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
          <Input
            value={username}
            disabled={isBusy}
            onChange={event => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="用户名或邮箱"
          />
          <Input
            value={password}
            disabled={isBusy}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder={savedLoginConfig?.hasPassword ? '输入新密码' : '密码'}
            type="password"
          />
          <Switch checked={autoLogin} disabled={isBusy} onCheckedChange={setAutoLogin} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isBusy || !canSave}
              onClick={() => onSave({ username, password, autoLogin })}
            >
              {isSaving ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              disabled={isBusy || !savedLoginConfig}
              onClick={onClear}
            >
              {isClearing ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </SettingRow>
    </SettingsSection>
  )
}

function accountDescription(savedLoginConfig: SavedLoginConfig | null | undefined) {
  if (!savedLoginConfig) {
    return '保存账号密码后，启动 APP 时自动重新登录并刷新用户资料'
  }

  if (savedLoginConfig.autoLogin) {
    return `已为 ${savedLoginConfig.username} 开启自动登录`
  }

  return `已保存 ${savedLoginConfig.username}，但未开启自动登录`
}
