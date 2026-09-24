import type { ClawDrop, WorldPoint } from '#src/types'

/** Состояние пружины: отклонение от цели и скорость его изменения. */
export type SpringState = {
  value: number
  velocity: number
}

/** Цель, период и затухание пружины. */
export type SpringOptions = {
  target: number
  periodMs: number
  damping: number
}

/** Настройки движения клешни: ожидание затухания качания и действие на доле хода. */
export type ClawMotionOptions = {
  readonly settleSwing?: boolean
  drop?: ClawDrop
}

/** Одно отменяемое движение клешни, выполняемое её кадровым шагом. */
export type ClawMotion = ClawMotionOptions & {
  readonly from: WorldPoint
  readonly to: WorldPoint
  readonly durationMs: number
  elapsed: number
  readonly complete: () => void
  readonly cancel: (reason: unknown) => void
}
