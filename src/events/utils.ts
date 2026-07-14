/**
 * Базовая трассировка событий для нужд разработки.
 */
export const traceEvent = import.meta.env.DEV
  ? (event: string, payload: unknown) => {
      // eslint-disable-next-line no-console
      console.debug(`%c[event] ${event}`, 'color: #a98fc3', payload)
    }
  : undefined
