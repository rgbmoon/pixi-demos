import { MACHINE_MAX_SCALE, SCREEN_MARGIN } from '#src/constants'
import type { MachineLayout } from '#src/types'

import { getMachineBounds } from './machine-geometry'

/** Центрирует измеренные границы корпуса и сохраняет минимальный отступ в одну ячейку. */
export const getMachineLayout = (
  viewLeft: number,
  viewTop: number,
  viewWidth: number,
  viewHeight: number
): MachineLayout => {
  const bounds = getMachineBounds()
  const scale = Math.min(
    MACHINE_MAX_SCALE,
    (viewWidth - 2 * SCREEN_MARGIN) / bounds.width,
    (viewHeight - 2 * SCREEN_MARGIN) / bounds.height
  )
  const centerX = viewLeft + viewWidth / 2
  const centerY = viewTop + viewHeight / 2

  return {
    scale,
    x: centerX - ((bounds.left + bounds.right) / 2) * scale,
    y: centerY - ((bounds.top + bounds.bottom) / 2) * scale,
  }
}
