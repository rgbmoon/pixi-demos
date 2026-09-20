import { describe, expect, it } from 'vitest'

import {
  AXIS_X,
  AXIS_Y,
  DEPTH_SCALE_MIN,
  JOYSTICK_DEADZONE,
  FIELD_CENTER,
  GRID_SIZE,
  TRAY_CENTER,
  TRAY_ORIGIN,
  TRAY_SIZE,
  UNIT_HEIGHT,
} from '#src/constants'
import {
  clampToField,
  getDepthScale,
  getFaceOutline,
  getTrayOutline,
  screenToGround,
  toGroundDirection,
  worldToScreen,
} from '#src/utils'

describe('worldToScreen', () => {
  it('держит начало координат в ближнем углу пола', () => {
    const { x, y } = worldToScreen({ x: 0, y: 0, z: 0 })

    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
  })

  it('уводит дальний угол вверх, боковые — в стороны', () => {
    const far = worldToScreen({ x: GRID_SIZE, y: GRID_SIZE, z: 0 })
    const left = worldToScreen({ x: 0, y: GRID_SIZE, z: 0 })
    const right = worldToScreen({ x: GRID_SIZE, y: 0, z: 0 })

    expect(left.x).toBeLessThan(0)
    expect(right.x).toBeGreaterThan(0)
    expect(far.y).toBeLessThan(Math.min(left.y, right.y))
  })

  it('показывает фронтальную грань шире правой', () => {
    const front = worldToScreen({ x: 0, y: GRID_SIZE, z: 0 })
    const side = worldToScreen({ x: GRID_SIZE, y: 0, z: 0 })

    // Фронтальная грань занимает заметно больше ширины экрана, чем уходящая в глубину правая
    expect(Math.abs(front.x)).toBeGreaterThan(2 * Math.abs(side.x))
  })

  it('держит фронтальную грань положе уходящей в глубину', () => {
    const frontSlope = Math.abs(AXIS_Y.y / AXIS_Y.x)
    const depthSlope = Math.abs(AXIS_X.y / AXIS_X.x)

    expect(frontSlope).toBeLessThan(depthSlope)
  })

  it('поднимает точку над полом ровно на высоту', () => {
    const floor = worldToScreen({ x: 3, y: 2, z: 0 })
    const raised = worldToScreen({ x: 3, y: 2, z: 2 })

    expect(raised.x).toBe(floor.x)
    expect(floor.y - raised.y).toBeCloseTo(2 * UNIT_HEIGHT)
  })
})

describe('screenToGround', () => {
  it('обращает проекцию на плоскости пола', () => {
    for (const point of [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 2.5, y: 6.25, z: 0 },
    ]) {
      const ground = screenToGround(worldToScreen(point))

      expect(ground.x).toBeCloseTo(point.x)
      expect(ground.y).toBeCloseTo(point.y)
    }
  })

  it('переводит шаг вдоль оси экрана в шаг по той же оси поля', () => {
    expect(screenToGround(AXIS_X).x).toBeCloseTo(1)
    expect(screenToGround(AXIS_X).y).toBeCloseTo(0)
    expect(screenToGround(AXIS_Y).x).toBeCloseTo(0)
    expect(screenToGround(AXIS_Y).y).toBeCloseTo(1)
  })

  it('переводит отклонение вниз в ход к игроку по обеим осям', () => {
    const ground = screenToGround({ x: 0, y: 10 })

    expect(ground.x).toBeLessThan(0)
    expect(ground.y).toBeLessThan(0)
  })
})

describe('toGroundDirection', () => {
  it('не трогает клешню в мёртвой зоне', () => {
    expect(toGroundDirection({ x: JOYSTICK_DEADZONE / 2, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(toGroundDirection({ x: JOYSTICK_DEADZONE, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('идёт на полной скорости при любом ходе ручки за мёртвой зоной', () => {
    const edge = toGroundDirection({ x: JOYSTICK_DEADZONE * 1.01, y: 0 })
    const beyond = toGroundDirection({ x: 3, y: -4 })

    expect(Math.hypot(edge.x, edge.y)).toBeCloseTo(1)
    expect(Math.hypot(beyond.x, beyond.y)).toBeCloseTo(1)
  })

  it('ведёт клешню туда же, куда тянут ручку', () => {
    // Вдоль оси глубины по экрану — ход по оси x поля; вектор длиннее мёртвой зоны
    const depth = toGroundDirection(AXIS_X)

    expect(depth.x).toBeGreaterThan(0)
    expect(depth.y).toBeCloseTo(0)

    // Вниз по экрану — ход к игроку по обеим осям
    const down = toGroundDirection({ x: 0, y: 1 })

    expect(down.x).toBeLessThan(0)
    expect(down.y).toBeLessThan(0)
  })

  it('отдаёт покой на отпущенной ручке', () => {
    expect(toGroundDirection({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('getDepthScale', () => {
  it('мельчит предмет по мере ухода в глубину', () => {
    expect(getDepthScale(0)).toBeCloseTo(1)
    expect(getDepthScale(GRID_SIZE)).toBeCloseTo(DEPTH_SCALE_MIN)
    expect(getDepthScale(GRID_SIZE / 2)).toBeLessThan(getDepthScale(0))
    expect(getDepthScale(GRID_SIZE / 2)).toBeGreaterThan(getDepthScale(GRID_SIZE))
  })

  it('не выходит за пределы поля', () => {
    expect(getDepthScale(-5)).toBeCloseTo(1)
    expect(getDepthScale(GRID_SIZE * 3)).toBeCloseTo(DEPTH_SCALE_MIN)
  })
})

describe('clampToField', () => {
  it('оставляет точку внутри поля нетронутой', () => {
    expect(clampToField({ x: 2.5, y: 7.25 })).toEqual({ x: 2.5, y: 7.25 })
  })

  it('прижимает точку к границам поля', () => {
    expect(clampToField({ x: -3, y: 12 })).toEqual({ x: 0, y: GRID_SIZE })
  })
})

describe('лоток', () => {
  it('стоит квадратом в левом углу фронтальной грани', () => {
    expect(TRAY_ORIGIN).toEqual({ col: 0, row: GRID_SIZE - TRAY_SIZE })
    expect(getTrayOutline()).toEqual([
      { x: 0, y: GRID_SIZE - TRAY_SIZE, z: 0 },
      { x: TRAY_SIZE, y: GRID_SIZE - TRAY_SIZE, z: 0 },
      { x: TRAY_SIZE, y: GRID_SIZE, z: 0 },
      { x: 0, y: GRID_SIZE, z: 0 },
    ])
  })

  it('принимает игрушку в свой центр, левее центра поля', () => {
    expect(TRAY_CENTER).toEqual({ x: TRAY_SIZE / 2, y: GRID_SIZE - TRAY_SIZE / 2 })
    // Центр лотка лежит на экране левее центра поля: лоток у левой грани
    expect(worldToScreen({ ...TRAY_CENTER, z: 0 }).x).toBeLessThan(worldToScreen({ ...FIELD_CENTER, z: 0 }).x)
  })
})

describe('getFaceOutline', () => {
  it('обходит грань по углам сетки на заданной высоте', () => {
    expect(getFaceOutline(4)).toEqual([
      { x: 0, y: 0, z: 4 },
      { x: GRID_SIZE, y: 0, z: 4 },
      { x: GRID_SIZE, y: GRID_SIZE, z: 4 },
      { x: 0, y: GRID_SIZE, z: 4 },
    ])
  })
})
