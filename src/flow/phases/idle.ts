import { waitFor } from 'src/events/helpers'
import { PhaseName } from 'src/types/game'

import type { Phase } from '../types'

export const idlePhase: Phase = {
  name: PhaseName.idle,

  enter: async ({ emitter, spinStore, signal }) => {
    const { bet } = await waitFor(emitter, 'ui:spinRequested', { signal })

    spinStore.setBet(bet)

    return PhaseName.spinning
  },
}
