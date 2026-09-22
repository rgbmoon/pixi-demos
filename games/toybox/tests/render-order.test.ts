import { describe, expect, it } from 'vitest'

import {
  AXIS_X,
  AXIS_Y,
  GRID_SIZE,
  MAX_LAYERS,
  SHAPES,
  TOY_LAYER_CENTER,
  TRAY_ORIGIN,
  TRAY_SIZE,
  UNIT_HEIGHT,
} from '#src/constants'
import type { CellAddress, Facing, ScreenPoint, ShapeKey, VolumeCell } from '#src/types'
import {
  FACINGS,
  getBodyCenter,
  getBodyDepth,
  getPlacementCells,
  getShapeCenter,
  getShapeOutline,
} from '#src/utils/heap'
import {
  getCellCenter,
  getDepthOrder,
  getDepthScale,
  getTrayWallOutlines,
  worldToScreen,
} from '#src/utils/projection'

type Polygon = ScreenPoint[]

type Bounds = {
  left: number
  right: number
  top: number
  bottom: number
}

type RenderPlacement = {
  shape: ShapeKey
  facing: Facing
  anchor: CellAddress
  layer: number
  cells: VolumeCell[]
  cellDepths: number[]
  depth: number
  fragments: Polygon[]
  fragmentBounds: Bounds[]
  bounds: Bounds
  occupied: Set<string>
}

const EPSILON = 1e-4
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]

const getBounds = (points: readonly ScreenPoint[]): Bounds => ({
  left: Math.min(...points.map(({ x }) => x)),
  right: Math.max(...points.map(({ x }) => x)),
  top: Math.min(...points.map(({ y }) => y)),
  bottom: Math.max(...points.map(({ y }) => y)),
})

const overlapsBounds = (left: Bounds, right: Bounds): boolean =>
  left.right > right.left && right.right > left.left && left.bottom > right.top && right.bottom > left.top

const getArea = (polygon: readonly ScreenPoint[]): number => {
  let area = 0

  for (let index = 0; index < polygon.length; index++) {
    const point = polygon[index]
    const next = polygon[(index + 1) % polygon.length]

    area += point.x * next.y - point.y * next.x
  }

  return area / 2
}

const clipHalfPlane = (polygon: readonly ScreenPoint[], normal: ScreenPoint, constant: number): Polygon => {
  const clipped: Polygon = []

  for (let index = 0; index < polygon.length; index++) {
    const point = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const pointDistance = point.x * normal.x + point.y * normal.y - constant
    const nextDistance = next.x * normal.x + next.y * normal.y - constant
    const pointInside = pointDistance <= EPSILON
    const nextInside = nextDistance <= EPSILON

    if (pointInside) clipped.push(point)

    if (pointInside !== nextInside) {
      const share = pointDistance / (pointDistance - nextDistance)

      clipped.push({
        x: point.x + (next.x - point.x) * share,
        y: point.y + (next.y - point.y) * share,
      })
    }
  }

  return clipped
}

const intersect = (left: readonly ScreenPoint[], right: readonly ScreenPoint[]): Polygon => {
  let intersection = [...left]
  const orientation = getArea(right) >= 0 ? 1 : -1

  for (let index = 0; index < right.length && intersection.length > 0; index++) {
    const point = right[index]
    const next = right[(index + 1) % right.length]
    const normal = {
      x: orientation * (next.y - point.y),
      y: -orientation * (next.x - point.x),
    }

    intersection = clipHalfPlane(intersection, normal, normal.x * point.x + normal.y * point.y)
  }

  return intersection
}

const getLocalFragments = (shape: ShapeKey, facing: Facing): Polygon[] => {
  const center = getShapeCenter(shape, facing)
  const origins = getPlacementCells(shape, facing, { col: 0, row: 0 }, 0).map(({ col, row, layer }) =>
    worldToScreen({ x: col - center.dx, y: row - center.dy, z: layer - center.dz })
  )

  return origins.map((origin, index) => {
    let fragment = getShapeOutline(shape, facing)

    for (let other = 0; other < origins.length; other++) {
      if (other === index) continue

      const target = origins[other]
      const normal = { x: 2 * (target.x - origin.x), y: 2 * (target.y - origin.y) }
      const constant = target.x ** 2 + target.y ** 2 - origin.x ** 2 - origin.y ** 2

      fragment = clipHalfPlane(fragment, normal, constant)
    }

    return fragment
  })
}

const geometry = new Map<string, Polygon[]>()

const createPlacement = (shape: ShapeKey, facing: Facing, anchor: CellAddress, layer: number): RenderPlacement => {
  const cells = getPlacementCells(shape, facing, anchor, layer)
  const center = getBodyCenter(shape, facing, anchor, layer)
  const offset = worldToScreen(center)
  const scale = getDepthScale(center.x)
  const key = `${shape}:${facing}`
  const local = geometry.get(key) ?? getLocalFragments(shape, facing)

  geometry.set(key, local)

  const fragments = local.map((polygon) =>
    polygon.map((point) => ({ x: offset.x + point.x * scale, y: offset.y + point.y * scale }))
  )

  return {
    shape,
    facing,
    anchor,
    layer,
    cells,
    cellDepths: cells.map((cell) =>
      getDepthOrder({ ...getCellCenter(cell), z: cell.layer + TOY_LAYER_CENTER })
    ),
    depth: getBodyDepth(shape, facing, anchor, layer),
    fragments,
    fragmentBounds: fragments.map(getBounds),
    bounds: getBounds(fragments.flat()),
    occupied: new Set(cells.map(({ col, row, layer: cellLayer }) => `${col}:${row}:${cellLayer}`)),
  }
}

const overlapsVolume = (left: RenderPlacement, right: RenderPlacement): boolean => {
  for (const cell of left.occupied) {
    if (right.occupied.has(cell)) return true
  }

  return false
}

const getPairRelation = (left: RenderPlacement, right: RenderPlacement) => {
  let relation = 0
  let overlaps = 0
  let crossing = false
  let tie = false

  if (!overlapsBounds(left.bounds, right.bounds)) return { crossing, relation, overlaps, tie }

  for (let leftIndex = 0; leftIndex < left.fragments.length; leftIndex++) {
    for (let rightIndex = 0; rightIndex < right.fragments.length; rightIndex++) {
      if (!overlapsBounds(left.fragmentBounds[leftIndex], right.fragmentBounds[rightIndex])) continue

      const overlap = intersect(left.fragments[leftIndex], right.fragments[rightIndex])

      if (overlap.length < 3 || Math.abs(getArea(overlap)) <= EPSILON) continue

      overlaps += 1

      const local = Math.sign(left.cellDepths[leftIndex] - right.cellDepths[rightIndex])

      if (local === 0) {
        tie = true
      } else if (relation !== 0 && relation !== local) {
        crossing = true
      } else {
        relation = local
      }
    }
  }

  return { crossing, relation, overlaps, tie }
}

const createAllPlacements = (): RenderPlacement[] => {
  const placements: RenderPlacement[] = []
  const orientations = new Set<string>()

  for (const shape of SHAPE_KEYS) {
    for (const facing of FACINGS) {
      const signature = getPlacementCells(shape, facing, { col: 0, row: 0 }, 0)
        .map(({ col, row, layer }) => `${col}:${row}:${layer}`)
        .sort()
        .join('|')
      const orientation = `${shape}:${signature}`

      if (orientations.has(orientation)) continue
      orientations.add(orientation)

      for (let col = 0; col < GRID_SIZE; col++) {
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let layer = 0; layer < MAX_LAYERS; layer++) {
            const placement = createPlacement(shape, facing, { col, row }, layer)
            const valid = placement.cells.every(
              (cell) =>
                cell.col >= 0 &&
                cell.col < GRID_SIZE &&
                cell.row >= 0 &&
                cell.row < GRID_SIZE &&
                cell.layer >= 0 &&
                cell.layer < MAX_LAYERS &&
                !(cell.col < TRAY_SIZE && cell.row >= TRAY_ORIGIN.row)
            )

            if (valid) placements.push(placement)
          }
        }
      }
    }
  }

  return placements
}

const placements = createAllPlacements()

const getWallDepth = (face: number, point: ScreenPoint): number => {
  if (face === 0) {
    const x = TRAY_ORIGIN.col + TRAY_SIZE
    const y = (point.x - x * AXIS_X.x) / AXIS_Y.x
    const z = (x * AXIS_X.y + y * AXIS_Y.y - point.y) / UNIT_HEIGHT

    return getDepthOrder({ x, y, z })
  }

  const y = TRAY_ORIGIN.row
  const x = (point.x - y * AXIS_Y.x) / AXIS_X.x
  const z = (x * AXIS_X.y + y * AXIS_Y.y - point.y) / UNIT_HEIGHT

  return getDepthOrder({ x, y, z })
}

const expectGroupOrder = (group: RenderPlacement[]): number => {
  let overlaps = 0

  for (let leftIndex = 0; leftIndex < group.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex++) {
      const left = group[leftIndex]
      const right = group[rightIndex]

      expect(overlapsVolume(left, right)).toBe(false)

      const pair = getPairRelation(left, right)

      if (pair.overlaps === 0) continue

      overlaps += 1
      expect(pair.crossing).toBe(false)
      expect(pair.tie).toBe(false)
      expect(Math.sign(left.depth - right.depth)).toBe(pair.relation)
    }
  }

  return overlaps
}

describe('порядок отрисовки игрушек', () => {
  it('совмещает единый zIndex со всеми пересечениями допустимых положений', () => {
    let contourPairs = 0
    let fragmentOverlaps = 0
    const failures: string[] = []

    for (let leftIndex = 0; leftIndex < placements.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex++) {
        const left = placements[leftIndex]
        const right = placements[rightIndex]

        if (!overlapsBounds(left.bounds, right.bounds) || overlapsVolume(left, right)) continue

        const pair = getPairRelation(left, right)

        if (pair.overlaps === 0) continue

        contourPairs += 1
        fragmentOverlaps += pair.overlaps

        if (pair.crossing || pair.tie || Math.sign(left.depth - right.depth) !== pair.relation) {
          failures.push(
            `${left.shape}:${left.anchor.col},${left.anchor.row},${left.layer} / ` +
              `${right.shape}:${right.anchor.col},${right.anchor.row},${right.layer}`
          )
        }
      }
    }

    expect(placements).toHaveLength(971)
    expect(contourPairs).toBe(45_678)
    expect(fragmentOverlaps).toBe(177_364)
    expect(failures).toEqual([])
  })

  it('сохраняет порядок относительно обеих стенок лотка', () => {
    const walls = getTrayWallOutlines().map((outline) => outline.map(worldToScreen))
    const wallDepth = getDepthOrder({ x: TRAY_ORIGIN.col + TRAY_SIZE, y: TRAY_ORIGIN.row, z: 0 })
    let overlappingPlacements = 0
    const failures: string[] = []

    for (const placement of placements) {
      let placementOverlaps = false
      const actual = Math.sign(placement.depth - wallDepth)

      for (let fragment = 0; fragment < placement.fragments.length; fragment++) {
        for (let face = 0; face < walls.length; face++) {
          const overlap = intersect(placement.fragments[fragment], walls[face])

          if (overlap.length < 3 || Math.abs(getArea(overlap)) <= EPSILON) continue

          placementOverlaps = true

          const center = overlap.reduce(
            (sum, point) => ({ x: sum.x + point.x / overlap.length, y: sum.y + point.y / overlap.length }),
            { x: 0, y: 0 }
          )
          const relation = Math.sign(placement.cellDepths[fragment] - getWallDepth(face, center))

          if (relation !== 0 && relation !== actual) {
            failures.push(
              `${placement.shape}:${placement.anchor.col},${placement.anchor.row},${placement.layer}:wall${face}`
            )
          }
        }
      }

      if (placementOverlaps) overlappingPlacements += 1
    }

    expect(overlappingPlacements).toBe(118)
    expect(failures).toEqual([])
  })

  it('сортирует три игрушки в вертикальной стопке', () => {
    const group = [
      createPlacement('square4', 0, { col: 3, row: 3 }, 0),
      createPlacement('bar2', 0, { col: 3, row: 3 }, 1),
      createPlacement('single', 0, { col: 3, row: 3 }, 2),
    ]

    expectGroupOrder(group)
    expect(group.map(({ depth }) => depth)).toEqual(
      [...group].map(({ depth }) => depth).sort((left, right) => left - right)
    )
  })

  it('сортирует три игрушки друг за другом', () => {
    expect(
      expectGroupOrder([
        createPlacement('single', 0, { col: 2, row: 3 }, 0),
        createPlacement('single', 0, { col: 3, row: 3 }, 0),
        createPlacement('single', 0, { col: 4, row: 3 }, 0),
      ])
    ).toBeGreaterThanOrEqual(2)
  })

  it('сортирует соседние игрушки на разных слоях', () => {
    const group = [
      createPlacement('square4', 0, { col: 2, row: 2 }, 0),
      createPlacement('cube8', 0, { col: 4, row: 2 }, 0),
      createPlacement('single', 0, { col: 6, row: 2 }, 1),
    ]

    expect(expectGroupOrder(group)).toBeGreaterThanOrEqual(2)
  })

  it('сортирует смешанную стопку с cube8', () => {
    const group = [
      createPlacement('cube8', 0, { col: 3, row: 3 }, 0),
      createPlacement('square4', 0, { col: 3, row: 3 }, 2),
      createPlacement('single', 0, { col: 3, row: 3 }, 3),
    ]

    expectGroupOrder(group)
    expect(group.map(({ depth }) => depth)).toEqual(
      [...group].map(({ depth }) => depth).sort((left, right) => left - right)
    )
  })
})
