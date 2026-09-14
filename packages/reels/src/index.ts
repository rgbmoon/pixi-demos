// Публичный API рил-машины: потребители импортируют только отсюда.
// Внутри пакета баррель не используется: модули импортируют друг друга напрямую, иначе появятся циклические зависимости
export { Cell } from './cell'
export { DEFAULT_BUFFER, WRAP_EPSILON } from './constants'
export { Reel } from './reel'
export { ReelStrip } from './reel-strip'
export { ReelsMachine } from './reels-machine'
export { Row } from './row'
export { GravityFallStrategy } from './strategies/gravity-fall'
export { LinearSpinStrategy } from './strategies/linear-spin'
export { PlannedLandingStrategy } from './strategies/planned-landing'
export type { GravityFallOptions, LinearSpinOptions, PlannedLandingOptions } from './strategies/types'
export { ReelPhase } from './types'
export type {
  CascadeOptions,
  CellIndex,
  FallContext,
  FallDrop,
  FallPlan,
  FallStrategy,
  LandingContext,
  LandingPlan,
  LandingStrategy,
  LandOptions,
  ReelCascadeOptions,
  ReelContext,
  ReelDef,
  ReelLandOptions,
  ReelMeta,
  ReelModel,
  ReelOptions,
  ReelsConfig,
  ReelsData,
  ReelsModel,
  ReelStrategies,
  SpinOptions,
  SpinPlan,
  SpinStrategy,
  StripSlot,
} from './types'
export { getAlignmentGap, getDataValues, getLap, wrapOffset } from './utils'
