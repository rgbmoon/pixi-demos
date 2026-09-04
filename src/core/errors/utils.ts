import { DEFAULT_MESSAGE, NOTICE_EVENT } from './constants'
import { type Notice, NoticeSeverity } from './types'

/** Пишет ошибку в консоль; в прод-сборке отсутствует. Пара к traceEvent и tracePhase. */
export const traceError = import.meta.env.DEV
  ? (error: unknown, message?: string) => {
      // eslint-disable-next-line no-console
      console.error(`[error] ${message ?? DEFAULT_MESSAGE}`, error)
    }
  : undefined

/** Отличает отмену (уход со страницы, прерванный запрос) от настоящего сбоя. */
export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'

/** Собирает причину аборта, которую шина уведомлений отсеет как отмену. */
export const createAbortError = (message: string): DOMException => new DOMException(message, 'AbortError')

/** Короткое техническое описание ошибки: `name: message` или её строковое представление. */
export const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

const toDetail = (error: unknown): string | undefined =>
  error === undefined || error === null ? undefined : describeError(error)

const notify = (severity: NoticeSeverity, error: unknown, message?: string): void => {
  if (isAbortError(error)) {
    return
  }

  const notice: Notice = { severity, message: message ?? DEFAULT_MESSAGE, detail: toDetail(error) }

  traceError?.(error, notice.message)

  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: notice }))
}

/** Восстановимая ошибка: уходит в снекбар, игра продолжается. */
export const notifyError = (error: unknown, message?: string): void => {
  notify(NoticeSeverity.error, error, message)
}

/** Фатальная ошибка: уходит в оверлей над канвасом. */
export const notifyFatal = (error: unknown, message?: string): void => {
  notify(NoticeSeverity.fatal, error, message)
}

/** Подписывает `handler` на уведомления. Возвращает функцию отписки — её обязан вызвать владелец подписки. */
export const onNotice = (handler: (notice: Notice) => void): (() => void) => {
  const listener = (event: WindowEventMap[typeof NOTICE_EVENT]) => {
    handler(event.detail)
  }

  window.addEventListener(NOTICE_EVENT, listener)

  return () => {
    window.removeEventListener(NOTICE_EVENT, listener)
  }
}

/**
 * Вешает перехватчики необработанных исключений и реджектов на window — последний рубеж
 * для всего, что не поймано локально.
 */
export const installGlobalHandlers = (): void => {
  window.addEventListener('error', (event) => {
    notifyError(event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    notifyError(event.reason)
  })
}
