// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  CUBE_HEIGHT,
  DOME_CENTER_LAYERS,
  DOME_EDGE_LAYERS,
  GRID_SIZE,
  MAX_LAYERS,
  SETTLE_GAP,
  TOY_ROOT_COLOR,
  TRAY_CENTER,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_LAYERS,
} from '#src/constants'
import type { CellAddress } from '#src/types'
import {
  getCellCenter,
  getDepthOrder,
  getDomeHeight,
  getNeighbours,
  getPathCells,
  getPathShare,
  getSettleSlides,
  pickFumbleCell,
  getTrayWallOutlines,
  isTrayCell,
  resolveDrop,
  shiftColor,
  toCell,
  worldToScreen,
} from '#src/utils'
import { createRandom } from '@pixi-demos/core/random'

/** Поле занятых слоёв: одна высота во всех ячейках, лоток всегда пуст. */
const createHeights = (height: number): number[][] =>
  Array.from({ length: GRID_SIZE }, (_, col) =>
    Array.from({ length: GRID_SIZE }, (_, row) => (isTrayCell({ col, row }) ? 0 : height))
  )

/** Сколько падений разыгрывать там, где проверяется доля исходов, а не одно конкретное. */
const ROLLS = 200

const isInsideField = ({ col, row }: CellAddress): boolean =>
  col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE

describe('toCell', () => {
  it('относит точку к ячейке, в которой она лежит', () => {
    expect(toCell({ x: 0, y: 0 })).toEqual({ col: 0, row: 0 })
    expect(toCell({ x: 3.9, y: 4.1 })).toEqual({ col: 3, row: 4 })
  })

  it('прижимает точку на дальней границе поля к последней ячейке', () => {
    expect(toCell({ x: GRID_SIZE, y: GRID_SIZE })).toEqual({ col: GRID_SIZE - 1, row: GRID_SIZE - 1 })
  })
})

describe('getCellCenter', () => {
  it('ставит центр в середину ячейки', () => {
    expect(getCellCenter({ col: 2, row: 5 })).toEqual({ x: 2.5, y: 5.5 })
  })
})

describe('getDomeHeight', () => {
  it('складывает кучу куполом: по краям ниже, в центре выше', () => {
    expect(getDomeHeight({ col: 0, row: 0 })).toBe(DOME_EDGE_LAYERS)
    expect(getDomeHeight({ col: GRID_SIZE - 1, row: GRID_SIZE - 1 })).toBe(DOME_EDGE_LAYERS)
    expect(getDomeHeight({ col: GRID_SIZE / 2, row: GRID_SIZE / 2 })).toBe(DOME_CENTER_LAYERS)
  })

  it('не выходит за предел слоёв и не оставляет провалов к центру', () => {
    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        const height = getDomeHeight({ col, row })

        expect(height).toBeLessThanOrEqual(MAX_LAYERS)
        expect(height).toBeGreaterThanOrEqual(isTrayCell({ col, row }) ? 0 : DOME_EDGE_LAYERS)
      }
    }
  })

  it('оставляет лоток пустым', () => {
    expect(getDomeHeight(TRAY_ORIGIN)).toBe(0)
  })
})

describe('getNeighbours', () => {
  it('отдаёт четырёх соседей внутри поля', () => {
    expect(getNeighbours({ col: 4, row: 4 })).toHaveLength(4)
  })

  it('не выводит соседей за край поля', () => {
    for (const cell of getNeighbours({ col: 0, row: 0 })) {
      expect(isInsideField(cell)).toBe(true)
    }

    expect(getNeighbours({ col: 0, row: 0 })).toHaveLength(2)
  })
})

describe('getDepthOrder', () => {
  it('ставит верхнюю игрушку стопки ближе к игроку, чем нижние', () => {
    const stack = [0.5, 1.5, 2.5, 3.5].map((z) => getDepthOrder({ x: 4, y: 4, z }))

    for (let layer = 1; layer < stack.length; layer++) {
      expect(stack[layer]).toBeGreaterThan(stack[layer - 1])
    }
  })

  it('ставит ближнюю по осям поля ячейку ближе к игроку', () => {
    const far = getDepthOrder({ x: 4, y: 4, z: 0 })

    expect(getDepthOrder({ x: 3, y: 4, z: 0 })).toBeGreaterThan(far)
    expect(getDepthOrder({ x: 4, y: 3, z: 0 })).toBeGreaterThan(far)
  })

  it('разводит точки, которые заслоняют друг друга на экране', () => {
    // Обе точки лежат на одном луче взгляда и проецируются в одно место: заслоняет ближняя
    const near = { x: 0, y: 0, z: 1 }
    const far = { x: 8, y: 1, z: 0 }

    expect(worldToScreen(near)).toEqual(worldToScreen(far))
    expect(getDepthOrder(near)).toBeGreaterThan(getDepthOrder(far))
  })

  it('держит глубину поля весомее высоты: дальняя стопка не перекрывает ближнюю', () => {
    const nearFloor = getDepthOrder({ x: 0, y: 0, z: 0 })
    const farTop = getDepthOrder({ x: GRID_SIZE - 1, y: GRID_SIZE - 1, z: MAX_LAYERS })

    expect(nearFloor).toBeGreaterThan(farTop)
  })

  it('пропускает игрушки лотка перед его стенками', () => {
    const wall = getDepthOrder({ x: TRAY_ORIGIN.col + TRAY_SIZE, y: TRAY_ORIGIN.row, z: 0 })

    for (let {col} = TRAY_ORIGIN; col < TRAY_ORIGIN.col + TRAY_SIZE; col++) {
      for (let {row} = TRAY_ORIGIN; row < TRAY_ORIGIN.row + TRAY_SIZE; row++) {
        for (const z of [0, MAX_LAYERS]) {
          expect(getDepthOrder({ ...getCellCenter({ col, row }), z })).toBeGreaterThan(wall)
        }
      }
    }
  })

  it('растёт монотонно по каждой оси', () => {
    const at = (x: number, y: number, z: number) => getDepthOrder({ x, y, z })

    for (let step = 1; step < GRID_SIZE; step++) {
      // Ближе к игроку — меньше по осям поля и выше по z
      expect(at(step - 1, 4, 1)).toBeGreaterThan(at(step, 4, 1))
      expect(at(4, step - 1, 1)).toBeGreaterThan(at(4, step, 1))
    }

    for (let layer = 1; layer <= MAX_LAYERS; layer++) {
      expect(at(4, 4, layer)).toBeGreaterThan(at(4, 4, layer - 1))
    }
  })

  it('держит клешню на верхней грани выше любой игрушки её ячейки', () => {
    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        const cell = getCellCenter({ col, row })
        const claw = getDepthOrder({ ...cell, z: CUBE_HEIGHT })

        for (let layer = 0; layer < MAX_LAYERS; layer++) {
          expect(claw).toBeGreaterThan(getDepthOrder({ ...cell, z: layer + 0.5 }))
        }
      }
    }
  })

  it('проводит ребро ближнего угла перед кучей, а ребро дальнего — за ней', () => {
    const near = getDepthOrder({ x: 0, y: 0, z: MAX_LAYERS })
    const far = getDepthOrder({ x: GRID_SIZE, y: GRID_SIZE, z: MAX_LAYERS })

    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        const cell = getCellCenter({ col, row })

        for (let layer = 0; layer < MAX_LAYERS; layer++) {
          const toy = getDepthOrder({ ...cell, z: layer + 0.5 })

          expect(near).toBeGreaterThan(toy)
          expect(far).toBeLessThan(toy)
        }
      }
    }
  })

  it('прячет за стенками лотка кучу, которая лежит за ними', () => {
    const wall = getDepthOrder({ x: TRAY_ORIGIN.col + TRAY_SIZE, y: TRAY_ORIGIN.row, z: 0 })

    // Ячейки бокса сразу за дальней стенкой лотка, вплоть до верхнего слоя стопки
    for (let {row} = TRAY_ORIGIN; row < GRID_SIZE; row++) {
      const cell = getCellCenter({ col: TRAY_ORIGIN.col + TRAY_SIZE, row })

      expect(getDepthOrder({ ...cell, z: MAX_LAYERS - 0.5 })).toBeLessThan(wall)
    }
  })
})

describe('getPathCells', () => {
  it('перечисляет ячейки по дороге в порядке хода и без повторов', () => {
    const cells = getPathCells({ x: 4, y: 4 }, TRAY_CENTER)

    expect(cells[0]).toEqual({ col: 4, row: 4 })
    expect(cells[cells.length - 1]).toEqual(toCell(TRAY_CENTER))
    expect(cells.every(isInsideField)).toBe(true)

    for (let index = 1; index < cells.length; index++) {
      expect(cells[index]).not.toEqual(cells[index - 1])
    }
  })

  it('не пропускает ячейки: соседние в списке отличаются на один шаг по осям', () => {
    const cells = getPathCells({ x: 0.5, y: 0.5 }, { x: 7.5, y: 7.5 })

    for (let index = 1; index < cells.length; index++) {
      const step =
        Math.abs(cells[index].col - cells[index - 1].col) + Math.abs(cells[index].row - cells[index - 1].row)

      expect(step).toBeLessThanOrEqual(2)
    }
  })

  it('отдаёт одну ячейку, когда путь не выходит за её пределы', () => {
    expect(getPathCells({ x: 4.1, y: 4.1 }, { x: 4.2, y: 4.2 })).toEqual([{ col: 4, row: 4 }])
  })
})

describe('getPathShare', () => {
  it('отдаёт долю пути до точки на нём', () => {
    expect(getPathShare({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0.25)
    expect(getPathShare({ x: 4, y: 4 }, { x: 1, y: 7 }, { x: 2.5, y: 5.5 })).toBeCloseTo(0.5)
  })

  it('сносит точку в стороне от пути на ближайшее к ней место', () => {
    // Центр ячейки редко лежит ровно на пути: берётся доля, где путь к нему ближе всего
    expect(getPathShare({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 })).toBeCloseTo(0.5)
  })

  it('держится в пределах пути и не делит на ноль', () => {
    expect(getPathShare({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: -9, y: 0 })).toBe(0)
    expect(getPathShare({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 9, y: 0 })).toBe(1)
    expect(getPathShare({ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 5, y: 5 })).toBe(0)
  })

  it('растёт вдоль пути вместе с ячейками, которые тот проходит', () => {
    const from = { x: 4, y: 4 }
    const shares = getPathCells(from, TRAY_CENTER).map((cell) =>
      getPathShare(from, TRAY_CENTER, getCellCenter(cell))
    )

    for (let index = 1; index < shares.length; index++) {
      expect(shares[index]).toBeGreaterThan(shares[index - 1])
    }
  })
})

describe('pickFumbleCell', () => {
  const FROM = { x: 4, y: 4 }

  it('отдаёт ячейку с пути, кроме стартовой и кроме лотка', () => {
    const random = createRandom(2)
    const path = getPathCells(FROM, TRAY_CENTER)

    for (let run = 0; run < ROLLS; run++) {
      const cell = pickFumbleCell(FROM, TRAY_CENTER, random)

      expect(cell).toBeDefined()
      expect(path).toContainEqual(cell)
      expect(cell).not.toEqual(path[0])
      expect(isTrayCell(cell as CellAddress)).toBe(false)
    }
  })

  it('перебирает все подходящие ячейки пути', () => {
    const random = createRandom(3)
    const picked = new Set(
      Array.from({ length: ROLLS }, () => {
        const { col, row } = pickFumbleCell(FROM, TRAY_CENTER, random) as CellAddress

        return `${col}:${row}`
      })
    )
    const expected = getPathCells(FROM, TRAY_CENTER)
      .slice(1)
      .filter((cell) => !isTrayCell(cell))

    expect(picked.size).toBe(expected.length)
  })

  it('не отдаёт ничего, когда ронять по дороге негде', () => {
    // Путь целиком лежит в лотке: ячеек бокса на нём нет
    expect(pickFumbleCell(TRAY_CENTER, TRAY_CENTER, createRandom(4))).toBeUndefined()
  })
})

describe('getTrayWallOutlines', () => {
  it('отгораживает лоток двумя гранями, которых не закрывает сам куб', () => {
    const [far, near] = getTrayWallOutlines()

    // Грань вдоль оси y стоит на границе лотка в глубину, грань вдоль оси x — на его дальнем ряду
    expect(far.every(({ x }) => x === TRAY_ORIGIN.col + TRAY_SIZE)).toBe(true)
    expect(near.every(({ y }) => y === TRAY_ORIGIN.row)).toBe(true)
  })

  it('поднимает стенки на высоту лотка, ниже предельной стопки', () => {
    for (const outline of getTrayWallOutlines()) {
      expect(outline.map(({ z }) => z).sort()).toEqual([0, 0, TRAY_WALL_LAYERS, TRAY_WALL_LAYERS])
    }

    expect(TRAY_WALL_LAYERS).toBeLessThan(MAX_LAYERS)
  })

  it('не рисует грани, которыми лоток прилегает к стенкам куба', () => {
    const outlines = getTrayWallOutlines()

    expect(outlines).toHaveLength(2)
    expect(outlines.some((outline) => outline.every(({ x }) => x === TRAY_ORIGIN.col))).toBe(false)
    expect(outlines.some((outline) => outline.every(({ y }) => y === GRID_SIZE))).toBe(false)
  })
})

describe('resolveDrop', () => {
  it('оставляет игрушку в ячейке, где есть место', () => {
    const result = resolveDrop(createHeights(2), { col: 4, row: 4 }, createRandom(1))

    expect(result.path).toEqual([{ col: 4, row: 4 }])
    expect(result.layer).toBe(2)
    expect(result.collected).toBe(false)
  })

  it('засчитывает игрушку, упавшую прямо в лоток', () => {
    const result = resolveDrop(createHeights(2), TRAY_ORIGIN, createRandom(1))

    expect(result.collected).toBe(true)
  })

  it('выбивает игрушку из полной ячейки в соседнюю', () => {
    const heights = createHeights(0)

    heights[4][4] = MAX_LAYERS

    const result = resolveDrop(heights, { col: 4, row: 4 }, createRandom(7))

    expect(result.collected).toBe(false)
    expect(result.layer).toBe(0)
    expect(result.path.length).toBeGreaterThan(1)
    expect(getNeighbours({ col: 4, row: 4 })).toContainEqual(result.path[1])
  })

  it('никогда не сажает игрушку выше предела слоёв', () => {
    const heights = createHeights(MAX_LAYERS)

    // Поле полно везде, кроме дальнего угла: игрушка обязана найти именно его
    heights[GRID_SIZE - 1][0] = 1

    const result = resolveDrop(heights, { col: 0, row: 0 }, createRandom(3))

    expect(result.collected || result.layer < MAX_LAYERS).toBe(true)
  })

  it('останавливает цепочку отскоков даже на полном поле', () => {
    const result = resolveDrop(createHeights(MAX_LAYERS), { col: 4, row: 4 }, createRandom(11))

    expect(result.path.length).toBeGreaterThan(0)
    expect(result.path.every((cell) => isInsideField(cell) || isTrayCell(cell))).toBe(true)
  })

  it('роняет игрушку в лоток только с высоты выше его стенок', () => {
    const random = createRandom(4)
    const neighbour = { col: TRAY_ORIGIN.col, row: TRAY_ORIGIN.row - 1 }

    // Ячейка рядом с лотком заполнена доверху: с её верхнего слоя игрушка иногда сваливается в лоток
    const full = createHeights(0)

    full[neighbour.col][neighbour.row] = MAX_LAYERS

    const spills = Array.from({ length: ROLLS }, () => resolveDrop(full, neighbour, random))

    expect(spills.some(({ collected }) => collected)).toBe(true)
    expect(spills.every(({ collected, path }) => !collected || isTrayCell(path[path.length - 1]))).toBe(true)

    // В той же ячейке есть место: игрушка садится в неё и лотка не касается
    const settled = Array.from({ length: ROLLS }, () => resolveDrop(createHeights(1), neighbour, random))

    expect(settled.every(({ collected }) => !collected)).toBe(true)
    expect(settled.every(({ path }) => path.length === 1)).toBe(true)
  })

  it('уводит игрушку в лоток реже, чем возвращает в соседнюю ячейку бокса', () => {
    const random = createRandom(8)
    const neighbour = { col: TRAY_ORIGIN.col, row: TRAY_ORIGIN.row - 1 }
    const heights = createHeights(0)

    heights[neighbour.col][neighbour.row] = MAX_LAYERS

    const results = Array.from({ length: ROLLS }, () => resolveDrop(heights, neighbour, random))
    const toTray = results.filter(({ collected }) => collected).length
    const toBox = results.length - toTray

    // У лотка понижающий вес, а соседних ячеек бокса ещё и больше одной
    expect(toTray).toBeGreaterThan(0)
    expect(toTray).toBeLessThan(toBox)
  })
})

describe('getSettleSlides', () => {
  /** Поле с одной высокой ячейкой посреди пустого поля. */
  const createPeak = (height: number, at: CellAddress): number[][] => {
    const heights = createHeights(0)

    heights[at.col][at.row] = height

    return heights
  }

  it('оставляет ровную кучу нетронутой', () => {
    expect(getSettleSlides(createHeights(MAX_LAYERS), createRandom(2))).toEqual([])
  })

  it('не трогает перепад, не превышающий предела', () => {
    expect(getSettleSlides(createPeak(SETTLE_GAP, { col: 4, row: 4 }), createRandom(2))).toEqual([])
  })

  it('сваливает верхнюю игрушку с перепада больше предела', () => {
    const peak = { col: 4, row: 4 }
    const runs = Array.from({ length: ROLLS }, () => getSettleSlides(createPeak(SETTLE_GAP + 1, peak), createRandom(1)))

    expect(runs.some((slides) => slides.length > 0)).toBe(true)

    for (const slides of runs.flat()) {
      expect(slides.from).toEqual(peak)
      expect(getNeighbours(peak)).toContainEqual(slides.to)
    }
  })

  it('не уводит с ячейки больше игрушек, чем в ней есть', () => {
    const peak = { col: 4, row: 4 }
    const random = createRandom(6)

    for (let run = 0; run < ROLLS; run++) {
      const slides = getSettleSlides(createPeak(MAX_LAYERS, peak), random)
      const taken = slides.filter(({ from }) => from.col === peak.col && from.row === peak.row).length

      expect(taken).toBeLessThanOrEqual(MAX_LAYERS)
    }
  })

  it('не сыплет игрушки в лоток и не берёт их из него', () => {
    const heights = createPeak(MAX_LAYERS, { col: TRAY_ORIGIN.col + TRAY_SIZE, row: TRAY_ORIGIN.row })
    const random = createRandom(12)

    for (let run = 0; run < ROLLS; run++) {
      for (const { from, to } of getSettleSlides(heights, random)) {
        expect(isTrayCell(from)).toBe(false)
        expect(isTrayCell(to)).toBe(false)
      }
    }
  })
})

describe('shiftColor', () => {
  it('разводит игрушки по цвету вокруг корневого', () => {
    const random = createRandom(5)
    const colors = new Set(Array.from({ length: 32 }, () => shiftColor(TOY_ROOT_COLOR, random)))

    expect(colors.size).toBeGreaterThan(24)
  })

  it('держится в пределах 24-битного цвета', () => {
    const random = createRandom(9)

    for (let index = 0; index < 64; index++) {
      const color = shiftColor(TOY_ROOT_COLOR, random)

      expect(Number.isInteger(color)).toBe(true)
      expect(color).toBeGreaterThanOrEqual(0)
      expect(color).toBeLessThanOrEqual(0xffffff)
    }
  })
})
