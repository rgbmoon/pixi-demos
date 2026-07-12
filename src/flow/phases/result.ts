import { spinStore } from 'src/stores/spin-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

export const resultPhase: Phase = {
  name: PhaseName.result,

  enter: async ({ emitter, reels, signal }) => {
    const result = spinStore.result.value

    if (!result) {
      return PhaseName.idle
    }

    await reels.land(result, signal)

    emitter.emit('spin:landed', result)

    return PhaseName.idle
  },
}
