import { traceError } from './errors/utils'

/**
 * Читает булев флаг из `localStorage`. Нет значения, оно не `boolean` или хранилище недоступно
 * (приватный режим, окружение без Web Storage) — возвращает `fallback`.
 */
export const readStoredFlag = (key: string, fallback: boolean): boolean => {
  try {
    const raw = globalThis.localStorage?.getItem(key)

    if (raw === null || raw === undefined) return fallback

    const value: unknown = JSON.parse(raw)

    return typeof value === 'boolean' ? value : fallback
  } catch (error) {
    traceError?.(error, `Failed to read "${key}" from storage`)

    return fallback
  }
}

/** Пишет булев флаг в `localStorage`; недоступное хранилище только трассируется. */
export const writeStoredFlag = (key: string, value: boolean): void => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch (error) {
    traceError?.(error, `Failed to write "${key}" to storage`)
  }
}
