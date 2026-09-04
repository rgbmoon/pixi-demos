import { PALETTE } from 'src/core/palette'

/**
 * Базовая трассировка событий для нужд разработки.
 * Можно подключить инструменты алертинга вроде Sentry в будущем
 */
export const traceEvent = import.meta.env.DEV
  ? (event: string, payload: unknown) => {
      // eslint-disable-next-line no-console
      console.debug(`%c[event] ${event}`, `color: ${PALETTE.primary}`, payload)
    }
  : undefined
