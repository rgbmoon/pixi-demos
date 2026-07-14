import { PhaseName } from 'src/types/game'
import { RequestStatus } from 'src/types/network'

import type { Phase } from '../types'

export const spinningPhase: Phase = {
  name: PhaseName.spinning,

  enter: async ({ emitter, reels, spinStore, api, signal }) => {
    const { bet } = spinStore

    emitter.emit('spin:started', { bet })

    await Promise.all([spinStore.result.run(() => api.sendSpin(bet, signal)), reels.spin(signal)])

    if (spinStore.result.status === RequestStatus.error) {
      return PhaseName.idle
    }

    return PhaseName.result
  },
}
