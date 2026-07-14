import { waitFor } from 'src/events/helpers'
import { spinStore } from 'src/stores/spin-store'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

export const idlePhase: Phase = {
  name: PhaseName.idle,

  enter: async ({ emitter, signal }) => {
    const { bet } = await waitFor(emitter, 'ui:spinRequested', { signal })

    spinStore.setBet(bet)

    return PhaseName.spinning
  },
}
