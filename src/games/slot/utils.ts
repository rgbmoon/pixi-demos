import type { PointData } from 'pixi.js'
import { easeOutBack, getEaseOutBackInitialSpeed } from 'src/core/easing'
import { SymbolKey } from 'src/games/slot/types'

import { CELL_HEIGHT, CELL_WIDTH, LANDING_BACK_STRENGTH, LANDING_BRAKE_DISTANCE, LANDING_BRAKE_FRAMES, LANDING_DECELERATION, LANDING_EASE_CELLS, LANDING_HANDOVER_SPEED, PAYLINES, SPIN_SPEED } from './constants'
import type { LandingPlan, PaylineShape } from './types'

/** Возвращает линии, участвующие в раунде: первые `lines` ключей конфига. */
export const getActiveLineIds = (lines: number): string[] => Object.keys(PAYLINES).slice(0, lines)

/** Возвращает точки ломаной линии выплат в координатах зоны символов: от левой границы рамки через центры ячеек к правой. */
export const getPaylinePoints = ({ rows, offsetCells }: PaylineShape): PointData[] => {
  const offsetY = offsetCells * CELL_HEIGHT
  const cells = rows.map((row, reel) => ({ x: CELL_WIDTH * reel, y: CELL_HEIGHT * row + offsetY }))
  const first = cells[0]
  const last = cells[cells.length - 1]

  return [{ x: first.x - CELL_WIDTH / 2, y: first.y }, ...cells, { x: last.x + CELL_WIDTH / 2, y: last.y }]
}

const SYMBOL_KEYS = Object.values<SymbolKey>(SymbolKey)

export const getRandomSymbolKey = (): SymbolKey => SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]

/** Ключ символа для слота посадки; для буферной ячейки вне видимой зоны — случайный. */
export const getLandingKey = (symbolKeys: SymbolKey[], slotIndex: number): SymbolKey => {
  const key: SymbolKey | undefined = symbolKeys[slotIndex]

  return key ?? getRandomSymbolKey()
}

/** Путь ленты на равномерном участке посадки, px от её старта. */
const getCruisePosition = (frames: number): number => SPIN_SPEED * frames

/** Путь ленты на линейном торможении, px от начала торможения. */
const getBrakePosition = (frames: number): number => SPIN_SPEED * frames - (LANDING_DECELERATION * frames ** 2) / 2

/** Путь ленты на отскоке, px от начала отскока; на пике превышает `easeDistance`. */
const getEasePosition = (frames: number, easeFrames: number, easeDistance: number): number =>
  easeDistance * easeOutBack(Math.min(frames / easeFrames, 1), LANDING_BACK_STRENGTH)

/**
 * Считает расписание посадки барабана: полный путь ленты от позиции `fromY` и её позицию на любом кадре.
 * Путь складывается из оборота ленты, лесенки `offsetCells`, тормозного пути и хвоста отскока, а остаток
 * докручивается до границы ячейки. Позиция берётся из расписания по накопленным кадрам, поэтому границы
 * отрезков точны при любой частоте кадров.
 */
export const planLanding = (
  fromY: number,
  cellHeight: number,
  stripHeight: number,
  offsetCells: number
): LandingPlan => {
  const easeDistance = LANDING_EASE_CELLS * cellHeight
  // Полный оборот ленты в дистанции гарантирует, что каждый символ обернётся хотя бы раз и получит финальный ключ
  const plannedDistance = stripHeight + offsetCells * cellHeight + LANDING_BRAKE_DISTANCE + easeDistance
  // Точка посадки: докручиваем остаток до границы ячейки, дальше вся дистанция кратна ячейке
  const distance = plannedDistance + getAlignmentGap(fromY + plannedDistance, cellHeight)
  const cruiseDistance = distance - LANDING_BRAKE_DISTANCE - easeDistance
  const cruiseFrames = cruiseDistance / SPIN_SPEED
  // Отскок подхватывает ленту на LANDING_HANDOVER_SPEED: длительность подобрана по производной кривой в нуле
  const easeFrames = (getEaseOutBackInitialSpeed(LANDING_BACK_STRENGTH) * easeDistance) / LANDING_HANDOVER_SPEED
  const easeStartFrames = cruiseFrames + LANDING_BRAKE_FRAMES

  return {
    distance,
    totalFrames: easeStartFrames + easeFrames,
    positionAt: (frames: number): number => {
      if (frames <= cruiseFrames) return getCruisePosition(frames)

      if (frames <= easeStartFrames) return cruiseDistance + getBrakePosition(frames - cruiseFrames)

      return (
        cruiseDistance + LANDING_BRAKE_DISTANCE + getEasePosition(frames - easeStartFrames, easeFrames, easeDistance)
      )
    },
  }
}

/** Форматирует денежную сумму для HUD: разряды через запятую, два знака после точки. */
export const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Сколько ленте не хватает до ближайшей границы ячейки: добор до ровной посадки символов в слоты. */
export const getAlignmentGap = (position: number, cellHeight: number) => {
  const offset = ((position % cellHeight) + cellHeight) % cellHeight

  return (cellHeight - offset) % cellHeight
}
