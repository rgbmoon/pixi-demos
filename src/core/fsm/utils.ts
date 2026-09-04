import { PALETTE } from 'src/core/palette'

/**
 * Базовая трассировка смены фаз для нужд разработки — парная traceEvent эмиттера.
 */
export const tracePhase = import.meta.env.DEV
  ? (phase: string) => {
      // eslint-disable-next-line no-console
      console.debug(`%c[phase] ${phase}`, `color: ${PALETTE.accent}`)
    }
  : undefined
