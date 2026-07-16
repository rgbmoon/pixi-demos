import { PALETTE } from 'src/constants/palette'
import type { PhaseName } from 'src/types/game'

/**
 * Базовая трассировка смены фаз для нужд разработки — парная traceEvent эмиттера.
 */
export const tracePhase = import.meta.env.DEV
  ? (phase: PhaseName) => {
      // eslint-disable-next-line no-console
      console.debug(`%c[phase] ${phase}`, `color: ${PALETTE.accent}`)
    }
  : undefined
