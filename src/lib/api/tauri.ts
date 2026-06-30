import { invoke } from '@tauri-apps/api/core'

type TauriInvokeArgs = Record<string, unknown> | number[] | ArrayBuffer | Uint8Array

const DEFAULT_TAURI_RUNTIME_MESSAGE = 'This content needs the Tauri desktop runtime.'

export function hasTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function ensureTauriRuntime(message = DEFAULT_TAURI_RUNTIME_MESSAGE) {
  if (!hasTauriRuntime()) {
    throw new Error(message)
  }
}

export function tauriInvoke<T>(
  command: string,
  args?: TauriInvokeArgs,
  runtimeMessage = DEFAULT_TAURI_RUNTIME_MESSAGE
): Promise<T> {
  ensureTauriRuntime(runtimeMessage)

  return invoke<T>(command, args)
}
