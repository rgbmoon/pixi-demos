import { REDUCED_MOTION_QUERY } from './constants'

/** Включена ли системная настройка уменьшенного движения; в окружении без `matchMedia` — `false`. */
export const isReducedMotion = (): boolean => globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
