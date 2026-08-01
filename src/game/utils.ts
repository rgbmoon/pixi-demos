import type { Container, PointData, Ticker } from 'pixi.js'
import { SymbolKey } from 'src/types/game'

import {
  CELL_HEIGHT,
  CELL_WIDTH,
  GAME_ASPECT_RATIO,
  LANDING_BACK_STRENGTH,
  LANDING_BRAKE_DISTANCE,
  LANDING_BRAKE_FRAMES,
  LANDING_DECELERATION,
  LANDING_EASE_CELLS,
  LANDING_HANDOVER_SPEED,
  PAYLINES,
  REFERENCE_BACK_FACTOR,
  REFERENCE_OVERSHOOT,
  SPIN_SPEED,
  SYMBOL_ART_BOXES,
  SYMBOL_FIT_HEIGHT,
  SYMBOL_FIT_WIDTH,
} from './constants'
import type { GameTicker } from './game-ticker'
import type { CanvasSize, LandingPlan, PaylineShape, SymbolFit } from './types'

/**
 * Размер канваса: `GAME_ASPECT_RATIO`-бокс во всю высоту доступной области.
 * Считается один раз на маунте — на ресайз окна канвас не отвечает.
 */
export const getCanvasSize = (availableWidth: number, availableHeight: number): CanvasSize => {
  const height = Math.min(availableHeight, availableWidth / GAME_ASPECT_RATIO)

  return { width: height * GAME_ASPECT_RATIO, height }
}

/**
 * Считает посадку арта символа в подложку: контент от 228 до 483 единиц, поэтому крупные
 * уменьшаются до `SYMBOL_FIT_*`, а смещённый относительно холста центр возвращается в центр ячейки.
 */
export const getSymbolFit = (key: SymbolKey): SymbolFit => {
  const box = SYMBOL_ART_BOXES[key]
  const scale = Math.min(1, SYMBOL_FIT_WIDTH / box.width, SYMBOL_FIT_HEIGHT / box.height)

  return { scale, offsetX: box.offsetX * scale, offsetY: box.offsetY * scale }
}

/** Форматирует денежную сумму для HUD: разряды через запятую, два знака после точки. */
export const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

/**
 * Ведёт alpha объекта к цели за `durationMs` на игровом тикере; промис резолвится на последнем кадре,
 * реджектится по `signal`. При `prefers-reduced-motion` значение выставляется сразу.
 */
export const tweenAlpha = (
  ticker: GameTicker,
  target: Container,
  to: number,
  durationMs: number,
  signal?: AbortSignal
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    const from = target.alpha
    const distance = to - from

    if (distance === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.alpha = to
      resolve()

      return
    }

    const settle = (finish: () => void) => {
      ticker.remove(step)
      signal?.removeEventListener('abort', handleAbort)

      finish()
    }

    const step = (frameTicker: Ticker) => {
      if (target.destroyed) {
        settle(resolve)

        return
      }

      const next = target.alpha + (distance * frameTicker.deltaMS) / durationMs

      // Знак distance учтён: условие означает «достигли или проскочили цель»
      if (Math.sign(distance) * (next - to) >= 0) {
        target.alpha = to
        settle(resolve)

        return
      }

      target.alpha = next
    }

    const handleAbort = () => settle(() => reject(signal?.reason as Error))

    signal?.addEventListener('abort', handleAbort, { once: true })

    ticker.add(step)
  })

const SYMBOL_KEYS = Object.values<SymbolKey>(SymbolKey)

export const getRandomSymbolKey = (): SymbolKey => SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]

/** Пересчитывает силу отката в коэффициент кривой: `backStrength` = 0.1 воспроизводит каноническую easeOutBack. */
const getBackFactor = (backStrength: number) => (backStrength * REFERENCE_BACK_FACTOR) / REFERENCE_OVERSHOOT

/**
 * Замедление с проскоком: кривая уходит за цель и возвращается к ней. `progress` и результат — доли единицы,
 * на пике результат превышает 1. Заброс равен `(4/27)·f³/(f+1)²` дистанции при коэффициенте `f`,
 * то есть растёт быстрее `backStrength`: 0.1 даёт 10% дистанции, 0.25 — уже 41%.
 */
export const easeOutBack = (progress: number, backStrength = 0.1) => {
  const backFactor = getBackFactor(backStrength)
  const cubicFactor = backFactor + 1
  // Кривая записана от точки прибытия: в конце движения progressFromEnd = 0, и результат равен ровно 1
  const progressFromEnd = progress - 1

  return 1 + cubicFactor * progressFromEnd ** 3 + backFactor * progressFromEnd ** 2
}

/**
 * Начальная скорость easeOutBack в единицах «дистанция за длительность» — производная кривой в `progress` = 0.
 * По ней подбирают длительность, чтобы кривая подхватила предшествующее движение без рывка.
 */
export const getEaseOutBackInitialSpeed = (backStrength = 0.1) => {
  const backFactor = getBackFactor(backStrength)
  const cubicFactor = backFactor + 1

  // Производная 3·cubicFactor·p² + 2·backFactor·p в точке progressFromEnd = -1
  return 3 * cubicFactor - 2 * backFactor
}

/** Сколько ленте не хватает до ближайшей границы ячейки: добор до ровной посадки символов в слоты. */
export const getAlignmentGap = (position: number, cellHeight: number) => {
  const offset = ((position % cellHeight) + cellHeight) % cellHeight

  return (cellHeight - offset) % cellHeight
}

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
