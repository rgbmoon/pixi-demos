// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  CUBE_HEIGHT,
  GRAB_MAX_CHANCE,
  GRAB_MIN_CHANCE,
  GRID_SIZE,
  HEAP_SNAPSHOT_VERSION,
  HOLE_FILL_MAX_CHANCE,
  MAX_LAYERS,
  SLIDE_MIN_DROP,
  SHAPES,
  SLIDE_MAX_CHANCE,
  TOY_RADIUS,
  TOY_ROOT_COLOR,
  TRAY_CENTER,
  TRAY_ORIGIN,
  TRAY_SIZE,
  TRAY_WALL_LAYERS,
} from '#src/constants'
import type { CellAddress, Facing, Hole, ScreenPoint, ShapeKey, VolumeCell } from '#src/types'
import { shiftColor } from '#src/utils/color'
import {
  canPlace,
  findLanding,
  findHoles,
  getBodyCenter,
  getBodyDepth,
  getGrabChance,
  getHoleFillChance,
  getImpact,
  getPlacementCells,
  getShapeCells,
  getShapeCenter,
  getShapeOutline,
  getSlideChance,
  getWeight,
  isBoxCell,
  isHeapSnapshot,
  isSupported,
  planDomeProfile,
  rotateFacing,
} from '#src/utils/heap'
import { getCellCenter, getDepthOrder, getNeighbours, getPathCells, getPathShare, getTrayWallOutlines, isTrayCell, pickFumbleCell, toCell, worldToScreen } from '#src/utils/projection'
import { createRandom } from '@pixi-demos/core/random'

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

describe('planDomeProfile', () => {
  const profiles = [1, 2, 3, 4, 5].map((seed) => planDomeProfile(createRandom(seed)))

  it('держит высоты в пределах куба и оставляет лоток пустым', () => {
    for (const profile of profiles) {
      for (let col = 0; col < GRID_SIZE; col++) {
        for (let row = 0; row < GRID_SIZE; row++) {
          expect(profile[col][row]).toBeGreaterThanOrEqual(0)
          expect(profile[col][row]).toBeLessThanOrEqual(MAX_LAYERS)

          if (isTrayCell({ col, row })) expect(profile[col][row]).toBe(0)
        }
      }
    }
  })

  it('кладёт по краям поля ниже, чем под пиком', () => {
    for (const profile of profiles) {
      const heights = profile.flatMap((rows: number[], col: number) =>
        rows.map((height: number, row: number) => ({
          height,
          edge: col === 0 || row === 0 || col === GRID_SIZE - 1 || row === GRID_SIZE - 1,
        }))
      )
      const average = (edge: boolean): number => {
        const picked = heights.filter((cell) => cell.edge === edge && cell.height > 0)

        return picked.reduce((sum, cell) => sum + cell.height, 0) / picked.length
      }

      expect(average(true)).toBeLessThan(average(false))
    }
  })

  it('каждый раз складывает кучу по-своему', () => {
    const shapes = new Set(profiles.map((profile) => profile.map((rows) => rows.join('')).join('|')))

    expect(shapes.size).toBe(profiles.length)
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

/** Занятость по списку клеток: предикат, который принимают чистые функции размещения. */
const createOccupancy = (cells: readonly VolumeCell[]) => {
  const taken = new Set(cells.map(({ col, row, layer }) => `${col}:${row}:${layer}`))

  return ({ col, row, layer }: VolumeCell) => taken.has(`${col}:${row}:${layer}`)
}

const FACINGS: Facing[] = [0, 1, 2, 3]

const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]

const toKeys = (cells: readonly { dx: number; dy: number; dz: number }[]): string[] =>
  cells.map(({ dx, dy, dz }) => `${dx}:${dy}:${dz}`).sort()

describe('getWeight', () => {
  it('считает весом число клеток формы', () => {
    expect(getWeight('single')).toBe(1)
    expect(getWeight('bar2')).toBe(2)
    expect(getWeight('square4')).toBe(4)
    expect(getWeight('cube8')).toBe(8)
  })
})

describe('getShapeCells', () => {
  it('возвращает исходный набор после четырёх поворотов', () => {
    for (const shape of SHAPE_KEYS) {
      let facing: Facing = 0

      for (let step = 0; step < 4; step++) {
        facing = rotateFacing(facing, 1)
      }

      expect(facing).toBe(0)
      expect(toKeys(getShapeCells(shape, facing))).toEqual(toKeys(getShapeCells(shape, 0)))
    }
  })

  it('не теряет и не добавляет клетки при повороте', () => {
    for (const shape of SHAPE_KEYS) {
      for (const facing of FACINGS) {
        const cells = getShapeCells(shape, facing)

        expect(cells).toHaveLength(getWeight(shape))
        expect(new Set(toKeys(cells)).size).toBe(cells.length)
      }
    }
  })

  it('прижимает повёрнутую форму к нулевому якорю', () => {
    for (const shape of SHAPE_KEYS) {
      for (const facing of FACINGS) {
        const cells = getShapeCells(shape, facing)

        expect(Math.min(...cells.map(({ dx }) => dx))).toBe(0)
        expect(Math.min(...cells.map(({ dy }) => dy))).toBe(0)
      }
    }
  })

  it('не меняет занятость симметричных форм', () => {
    for (const shape of ['single', 'square4', 'cube8'] as ShapeKey[]) {
      for (const facing of FACINGS) {
        expect(toKeys(getShapeCells(shape, facing))).toEqual(toKeys(getShapeCells(shape, 0)))
      }
    }
  })

  it('разворачивает полосу поперёк при нечётном повороте', () => {
    expect(toKeys(getShapeCells('bar2', 1))).toEqual(
      toKeys([
        { dx: 0, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 },
      ])
    )
  })

  it('не держит в каталоге форм длиннее двух клеток', () => {
    for (const shape of SHAPE_KEYS) {
      for (const facing of FACINGS) {
        const cells = getShapeCells(shape, facing)

        for (const axis of ['dx', 'dy', 'dz'] as const) {
          const values = cells.map((cell) => cell[axis])

          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('findLanding', () => {
  it('учитывает высоту многоуровневой формы при старте падения', () => {
    expect(findLanding('cube8', 0, { col: 3, row: 3 }, MAX_LAYERS - 1, () => false)).toBe(0)
  })
})

describe('getShapeOutline', () => {
  /** Лежит ли точка внутри выпуклого контура: со всех его рёбер она видна с одной стороны. */
  const isInside = (outline: readonly ScreenPoint[], point: ScreenPoint): boolean => {
    const sides = outline.map((corner, index) => {
      const next = outline[(index + 1) % outline.length]

      return (next.x - corner.x) * (point.y - corner.y) - (next.y - corner.y) * (point.x - corner.x)
    })

    return sides.every((side) => side >= 0) || sides.every((side) => side <= 0)
  }

  /** Экранные центры клеток формы: контур обязан накрывать их все. */
  const getCellOrigins = (shape: ShapeKey, facing: Facing): ScreenPoint[] => {
    const center = getShapeCenter(shape, facing)

    return getShapeCells(shape, facing).map(({ dx, dy, dz }) =>
      worldToScreen({ x: dx - center.dx, y: dy - center.dy, z: dz - center.dz })
    )
  }

  it('накрывает центры всех клеток формы', () => {
    for (const shape of SHAPE_KEYS) {
      for (const facing of FACINGS) {
        const outline = getShapeOutline(shape, facing)

        for (const origin of getCellOrigins(shape, facing)) {
          expect(isInside(outline, origin)).toBe(true)
        }
      }
    }
  })

  it('остаётся выпуклым', () => {
    for (const shape of SHAPE_KEYS) {
      for (const facing of FACINGS) {
        const outline = getShapeOutline(shape, facing)

        expect(outline.length).toBeGreaterThan(2)

        for (const point of outline) {
          expect(isInside(outline, point)).toBe(true)
        }
      }
    }
  })

  it('обводит одноклеточную форму окружностью её радиуса', () => {
    for (const point of getShapeOutline('single', 0)) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(TOY_RADIUS, 6)
    }
  })

  it('смыкает составную форму в одну фигуру', () => {
    // Вдоль дальней оси клетки разнесены шире диаметра игрушки: до общего контура форма из двух
    // клеток распадалась на два шара со щелью между ними
    for (const facing of FACINGS) {
      const outline = getShapeOutline('bar2', facing)
      const [first, second] = getCellOrigins('bar2', facing)

      expect(isInside(outline, { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 })).toBe(true)
    }
  })
})

describe('findHoles', () => {
  /** Рельеф из карты высот: лоток всегда пуст. */
  const createSurface = (height: number, dips: { cell: CellAddress; height: number }[] = []) => {
    const map = Array.from({ length: GRID_SIZE }, (_, col) =>
      Array.from({ length: GRID_SIZE }, (_, row) => (isTrayCell({ col, row }) ? 0 : height))
    )

    for (const dip of dips) {
      map[dip.cell.col][dip.cell.row] = dip.height
    }

    return ({ col, row }: CellAddress) => map[col][row]
  }

  it('не находит дыр на ровном рельефе', () => {
    expect(findHoles(createSurface(3))).toEqual([])
  })

  it('не считает дырой неровность в один слой', () => {
    expect(findHoles(createSurface(3, [{ cell: { col: 4, row: 4 }, height: 2 }]))).toEqual([])
  })

  it('находит кратер целиком и считает глубину от его края', () => {
    const crater = [
      { cell: { col: 3, row: 3 }, height: 1 },
      { cell: { col: 4, row: 3 }, height: 1 },
      { cell: { col: 3, row: 4 }, height: 1 },
      { cell: { col: 4, row: 4 }, height: 1 },
    ]
    const holes = findHoles(createSurface(3, crater))

    expect(holes).toHaveLength(1)
    expect(holes[0].cells).toHaveLength(4)
    expect(holes[0].floor).toBe(1)
    expect(holes[0].depth).toBe(2)
  })

  it('не берёт лоток ни в дыру, ни в её край', () => {
    const holes = findHoles(createSurface(3, [{ cell: { col: 2, row: GRID_SIZE - 1 }, height: 0 }]))

    for (const hole of holes) {
      for (const cell of hole.cells) {
        expect(isTrayCell(cell)).toBe(false)
      }
    }
  })
})

describe('getHoleFillChance', () => {
  const hole = (area: number, depth: number, floor: number): Hole => ({
    cells: Array.from({ length: area }, (_, index) => ({ col: index, row: 0 })),
    depth,
    floor,
  })

  it('не трогает мелкую вмятину у вершины кучи', () => {
    expect(getHoleFillChance(1, hole(1, 2, MAX_LAYERS - 1))).toBe(0)
  })

  it('оставляет ненулевую вероятность засыпки дыры до пола', () => {
    expect(getHoleFillChance(1, hole(1, 2, 0))).toBeGreaterThan(0)
    expect(getHoleFillChance(8, hole(1, 2, 0))).toBeGreaterThan(0)
  })

  it('растёт с площадью основания и с глубиной', () => {
    expect(getHoleFillChance(1, hole(4, 2, 1))).toBeGreaterThan(getHoleFillChance(1, hole(2, 2, 1)))
    expect(getHoleFillChance(1, hole(2, 3, 1))).toBeGreaterThan(getHoleFillChance(1, hole(2, 2, 1)))
  })

  it('слабеет с весом игрушки и по мере подъёма дна', () => {
    expect(getHoleFillChance(8, hole(4, 2, 1))).toBeLessThan(getHoleFillChance(1, hole(4, 2, 1)))
    expect(getHoleFillChance(1, hole(4, 2, 2))).toBeLessThan(getHoleFillChance(1, hole(4, 2, 1)))
  })

  it('не превышает заданный предел', () => {
    expect(getHoleFillChance(1, hole(GRID_SIZE * GRID_SIZE, MAX_LAYERS, 0))).toBeLessThanOrEqual(
      HOLE_FILL_MAX_CHANCE
    )
  })
})

describe('isBoxCell', () => {
  it('не пускает игрушку за край поля, выше предела слоёв и в лоток', () => {
    expect(isBoxCell({ col: 4, row: 4, layer: 0 })).toBe(true)
    expect(isBoxCell({ col: -1, row: 4, layer: 0 })).toBe(false)
    expect(isBoxCell({ col: GRID_SIZE, row: 4, layer: 0 })).toBe(false)
    expect(isBoxCell({ col: 4, row: 4, layer: MAX_LAYERS })).toBe(false)
    expect(isBoxCell({ ...TRAY_ORIGIN, layer: 0 })).toBe(false)
  })
})

describe('canPlace', () => {
  it('не ставит игрушку в занятые клетки и за пределы куба', () => {
    const cells = getPlacementCells('bar2', 0, { col: 4, row: 4 }, 0)

    expect(canPlace(cells, createOccupancy([]))).toBe(true)
    expect(canPlace(cells, createOccupancy([{ col: 5, row: 4, layer: 0 }]))).toBe(false)
    expect(canPlace(getPlacementCells('bar2', 0, { col: GRID_SIZE - 1, row: 4 }, 0), createOccupancy([]))).toBe(false)
  })
})

describe('isSupported', () => {
  it('держит игрушку на полу', () => {
    expect(isSupported(getPlacementCells('cube8', 0, { col: 4, row: 4 }, 0), createOccupancy([]))).toBe(true)
  })

  it('позволяет полосе нависать ровно наполовину', () => {
    const cells = getPlacementCells('bar2', 0, { col: 4, row: 4 }, 1)

    expect(isSupported(cells, createOccupancy([{ col: 4, row: 4, layer: 0 }]))).toBe(true)
    expect(isSupported(cells, createOccupancy([]))).toBe(false)
  })

  it('роняет квадрат, стоящий на одной клетке из четырёх', () => {
    const cells = getPlacementCells('square4', 0, { col: 4, row: 4 }, 1)

    expect(isSupported(cells, createOccupancy([{ col: 4, row: 4, layer: 0 }]))).toBe(false)
    expect(
      isSupported(
        cells,
        createOccupancy([
          { col: 4, row: 4, layer: 0 },
          { col: 5, row: 4, layer: 0 },
        ])
      )
    ).toBe(true)
  })

  it('смотрит только на нижние клетки: верхний слой кубика опоры не требует', () => {
    const cells = getPlacementCells('cube8', 0, { col: 4, row: 4 }, 1)
    const below = getPlacementCells('square4', 0, { col: 4, row: 4 }, 0)

    expect(isSupported(cells, createOccupancy(below))).toBe(true)
  })
})

describe('getBodyCenter', () => {
  it('ставит середину одноклеточной игрушки в центр её клетки', () => {
    expect(getBodyCenter('single', 0, { col: 2, row: 5 }, 1)).toEqual({ x: 2.5, y: 5.5, z: 1.5 })
  })

  it('ставит середину квадрата на стык его клеток', () => {
    expect(getBodyCenter('square4', 0, { col: 2, row: 5 }, 0)).toEqual({ x: 3, y: 6, z: 0.5 })
  })

  it('поднимает середину кубика на границу его слоёв', () => {
    expect(getBodyCenter('cube8', 0, { col: 2, row: 5 }, 0).z).toBe(1)
  })
})

describe('getBodyDepth', () => {
  it('берёт ключ ближней к игроку клетки', () => {
    const anchor = { col: 2, row: 3 }
    const depth = getBodyDepth('bar2', 0, anchor, 0)

    expect(depth).toBe(getDepthOrder({ ...getCellCenter(anchor), z: 0.5 }))
  })

  it('ставит крупную игрушку перед той, что лежит за её ближним краем', () => {
    const bar = getBodyDepth('bar2', 0, { col: 2, row: 3 }, 0)
    const behind = getBodyDepth('single', 0, { col: 3, row: 3 }, 0)

    expect(bar).toBeGreaterThan(behind)
  })
})

describe('getGrabChance', () => {
  it('снижает шанс и от веса, и от нагрузки сверху', () => {
    expect(getGrabChance(1, 0)).toBeGreaterThan(getGrabChance(8, 0))
    expect(getGrabChance(1, 0)).toBeGreaterThan(getGrabChance(1, 4))
  })

  it('держится в своих пределах при любом весе и нагрузке сверху', () => {
    for (const weight of [1, 2, 3, 4, 8]) {
      for (const load of [0, 1, 8, 64]) {
        const chance = getGrabChance(weight, load)

        expect(chance).toBeGreaterThanOrEqual(GRAB_MIN_CHANCE)
        expect(chance).toBeLessThanOrEqual(GRAB_MAX_CHANCE)
      }
    }
  })
})

describe('getSlideChance', () => {
  it('не трогает перепад в пределах порога', () => {
    expect(getSlideChance(1, SLIDE_MIN_DROP)).toBe(0)
    expect(getSlideChance(1, 0)).toBe(0)
  })

  it('растёт с перепадом и падает с весом', () => {
    expect(getSlideChance(1, SLIDE_MIN_DROP + 2)).toBeGreaterThan(getSlideChance(1, SLIDE_MIN_DROP + 1))
    expect(getSlideChance(1, SLIDE_MIN_DROP + 1)).toBeGreaterThan(getSlideChance(8, SLIDE_MIN_DROP + 1))
  })

  it('не выходит за потолок вероятности', () => {
    expect(getSlideChance(1, MAX_LAYERS * 4)).toBeLessThanOrEqual(SLIDE_MAX_CHANCE)
  })
})

describe('getImpact', () => {
  it('бьёт тем сильнее, чем тяжелее игрушка и чем ближе сосед', () => {
    expect(getImpact(8, 1)).toBeGreaterThan(getImpact(1, 1))
    expect(getImpact(8, 1)).toBeGreaterThan(getImpact(8, 3))
  })
})

describe('isHeapSnapshot', () => {
  const snapshot = {
    version: HEAP_SNAPSHOT_VERSION,
    collected: 3,
    bodies: [{ shape: 'cube8', facing: 2, anchor: { col: 3, row: 4 }, layer: 0, color: 0xffa24b }],
  }

  it('принимает снимок своей версии', () => {
    expect(isHeapSnapshot(snapshot)).toBe(true)
    expect(isHeapSnapshot({ ...snapshot, bodies: [] })).toBe(true)
  })

  it('отбрасывает чужую версию, мусор и незнакомую форму', () => {
    expect(isHeapSnapshot({ ...snapshot, version: HEAP_SNAPSHOT_VERSION + 1 })).toBe(false)
    expect(isHeapSnapshot(undefined)).toBe(false)
    expect(isHeapSnapshot('heap')).toBe(false)
    expect(isHeapSnapshot({ ...snapshot, bodies: [{ ...snapshot.bodies[0], shape: 'pyramid' }] })).toBe(false)
    expect(isHeapSnapshot({ ...snapshot, bodies: [{ ...snapshot.bodies[0], shape: 'ell3' }] })).toBe(false)
    expect(isHeapSnapshot({ ...snapshot, bodies: [{ ...snapshot.bodies[0], anchor: { col: 3 } }] })).toBe(false)
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
