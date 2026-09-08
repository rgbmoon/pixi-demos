import { easeOutBack, getEaseOutBackInitialSpeed } from 'src/core/easing'
import type { LandingContext, LandingPlan, LandingStrategy } from 'src/core/reels/types'
import { getAlignmentGap } from 'src/core/reels/utils'

import type { PlannedLandingOptions } from './types'

/**
 * Расписание посадки из трёх участков: равномерный ход, линейное торможение и отскок.
 * Путь складывается из оборота ленты, лесенки по номеру барабана, тормозного пути и хвоста отскока,
 * а остаток докручивается до границы ячейки. Позиция берётся из расписания по накопленным кадрам,
 * поэтому границы отрезков точны при любой частоте кадров.
 */
export class PlannedLandingStrategy implements LandingStrategy {
  private readonly options: PlannedLandingOptions
  private readonly brakeFrames: number
  private readonly brakeDistance: number

  constructor(options: PlannedLandingOptions) {
    const { speed, handoverSpeed, deceleration } = options

    this.options = options
    this.brakeFrames = (speed - handoverSpeed) / deceleration
    this.brakeDistance = (speed ** 2 - handoverSpeed ** 2) / (2 * deceleration)
  }

  plan(context: LandingContext): LandingPlan {
    const { speed, handoverSpeed, easeCells, backStrength, staggerCells } = this.options
    const { fromOffset, index, cellHeight, stripHeight } = context

    const easeDistance = easeCells * cellHeight
    // Полный оборот ленты в дистанции гарантирует, что каждый слот обернётся хотя бы раз и получит финальное значение
    const plannedDistance = stripHeight + index * staggerCells * cellHeight + this.brakeDistance + easeDistance
    // Точка посадки: докручиваем остаток до границы ячейки, дальше вся дистанция кратна ячейке
    const distance = plannedDistance + getAlignmentGap(fromOffset + plannedDistance, cellHeight)
    const cruiseDistance = distance - this.brakeDistance - easeDistance
    const cruiseFrames = cruiseDistance / speed
    // Отскок подхватывает ленту на handoverSpeed: длительность подобрана по производной кривой в нуле
    const easeFrames = (getEaseOutBackInitialSpeed(backStrength) * easeDistance) / handoverSpeed
    const easeStartFrames = cruiseFrames + this.brakeFrames

    return {
      distance,
      totalFrames: easeStartFrames + easeFrames,
      positionAt: (frames: number): number => {
        if (frames <= cruiseFrames) return this.getCruisePosition(frames)

        if (frames <= easeStartFrames) return cruiseDistance + this.getBrakePosition(frames - cruiseFrames)

        return (
          cruiseDistance +
          this.brakeDistance +
          this.getEasePosition(frames - easeStartFrames, easeFrames, easeDistance)
        )
      },
    }
  }

  /** Путь ленты на равномерном участке, от её старта. */
  private getCruisePosition(frames: number): number {
    return this.options.speed * frames
  }

  /** Путь ленты на линейном торможении, от начала торможения. */
  private getBrakePosition(frames: number): number {
    return this.options.speed * frames - (this.options.deceleration * frames ** 2) / 2
  }

  /** Путь ленты на отскоке, от начала отскока; на пике превышает `easeDistance`. */
  private getEasePosition(frames: number, easeFrames: number, easeDistance: number): number {
    return easeDistance * easeOutBack(Math.min(frames / easeFrames, 1), this.options.backStrength)
  }
}
