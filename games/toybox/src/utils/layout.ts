import { MACHINE_MARGIN } from '#src/constants'
import type { MachineLayout } from '#src/types'

import { getMachineBounds } from './machine-geometry'

/** Вписывает корпус в область `width × height` одним масштабом с отступом `MACHINE_MARGIN` и центрирует его. */
export const getMachineLayout = (width: number, height: number): MachineLayout => {
  const bounds = getMachineBounds()
  const scale = Math.min(width / (bounds.width + 2 * MACHINE_MARGIN), height / (bounds.height + 2 * MACHINE_MARGIN))

  return {
    scale,
    x: width / 2 - ((bounds.left + bounds.right) / 2) * scale,
    y: height / 2 - ((bounds.top + bounds.bottom) / 2) * scale,
  }
}

/** Пропорции корпуса вместе с отступом: по ним хост строит канвас шире `CANVAS_FILL_MAX_WIDTH`. */
export const getMachineAspectRatio = (): number => {
  const bounds = getMachineBounds()

  return (bounds.width + 2 * MACHINE_MARGIN) / (bounds.height + 2 * MACHINE_MARGIN)
}
