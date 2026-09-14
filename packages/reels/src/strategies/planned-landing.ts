import { easeOutBack, getEaseOutBackInitialSpeed } from '#src/easing'
import type { LandingContext, LandingPlan, LandingStrategy } from '#src/types'
import { getAlignmentGap } from '#src/utils'

import type { PlannedLandingOptions } from './types'

/**
 * Расписание посадки из трёх участков: равномерный ход, линейное торможение и отскок.
 * Позиция считается по накопленным кадрам, поэтому границы участков не зависят от частоты кадров.
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
    const {
      speed,
      handoverSpeed,
      easeCells,
      backStrength,
      staggerCells,
      minSpinFrames = 0,
      anticipationCells = 0,
    } = this.options
    const { fromOffset, spunFrames, anticipationPauses, isAnticipating, order, cellHeight, stripHeight } = context

    const easeDistance = easeCells * cellHeight
    // Ответ пришёл раньше минимума вращения: недостающие кадры добавляются к равномерному участку
    const minSpinDistance = Math.max(0, minSpinFrames - spunFrames) * speed
    // Паузы anticipation — часть равномерного участка, slam проматывает их вместе с ним
    const anticipationDistance = anticipationPauses * anticipationCells * cellHeight
    // Оборот ленты в пути: каждый слот перенесётся хотя бы раз и получит значение раунда
    const plannedDistance =
      stripHeight +
      minSpinDistance +
      order * staggerCells * cellHeight +
      anticipationDistance +
      this.brakeDistance +
      easeDistance
    // Добор до границы ячейки делает путь кратным высоте ячейки
    const distance = plannedDistance + getAlignmentGap(fromOffset + plannedDistance, cellHeight)
    const cruiseDistance = distance - this.brakeDistance - easeDistance
    const cruiseFrames = cruiseDistance / speed
    // Длительность отскока подобрана так, чтобы начальная скорость кривой равнялась handoverSpeed
    const easeFrames = (getEaseOutBackInitialSpeed(backStrength) * easeDistance) / handoverSpeed
    const easeStartFrames = cruiseFrames + this.brakeFrames
    const totalFrames = easeStartFrames + easeFrames
    // Собственная пауза удлиняет равномерный участок: без неё барабан остановился бы на pauseFrames раньше
    const pauseFrames = (anticipationCells * cellHeight) / speed

    return {
      distance,
      totalFrames,
      // Slam проматывает равномерный участок и торможение, отскок проигрывается полностью
      settleFrames: easeStartFrames,
      anticipationFrames: isAnticipating && pauseFrames > 0 ? totalFrames - pauseFrames : undefined,
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
