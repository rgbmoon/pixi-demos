import type { GameTicker } from 'src/game/game-ticker'
import type { SkeletonLike } from 'src/game/types'

import { STUB_SKELETONS } from './constants'
import { StubSpine } from './stub-spine'

/** Собирает стаб-скелет по описанию из базы мока; имя без описания — ошибка данных. */
export const createStubSkeleton = (skeleton: string, ticker: GameTicker): SkeletonLike => {
  const data = STUB_SKELETONS.get(skeleton)

  if (!data) {
    throw new Error(`Stub skeleton: no description for "${skeleton}"`)
  }

  return new StubSpine(data, ticker)
}
