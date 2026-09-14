import type { GameTicker } from '#src/game-ticker'
import type { SkeletonLike } from '#src/types'

import { StubSpine } from './stub-spine'
import type { StubSkeletonData } from './types'

/** Собирает стаб-скелет по описанию; описание приходит от игры, база стабов общей не бывает. */
export const createStubSkeleton = (data: StubSkeletonData, ticker: GameTicker): SkeletonLike =>
  new StubSpine(data, ticker)
