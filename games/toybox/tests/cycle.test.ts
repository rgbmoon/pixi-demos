// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  FIELD_CENTER,
  FUMBLE_CHANCE,
  LIFT_FUMBLE_CHANCE,
  PHASE_PAUSE_MS,
  TRAY_CENTER,
  PRIZE_PAUSE_MS,
  PRIZE_OPEN_HOLD_MS,
  TRAY_HOLD_MS,
  TRAY_RELEASE_MS,
} from '#src/constants'
import { PhaseName } from '#src/types'
import { isTrayCell } from '#src/utils/projection'

import { countToys, type Cycle, emptyHeap, getGrabRolls, getHomeCell, startCycle } from './setup/cycle'

/** Бросок, на котором клешня роняет игрушку, и бросок, на котором она её доносит. */
const FUMBLE_HIT = FUMBLE_CHANCE / 2
const FUMBLE_MISS = (1 + FUMBLE_CHANCE) / 2

/** Бросок, на котором игрушка выскальзывает при подъёме, и бросок, на котором она удерживается. */
const SLIP_HIT = LIFT_FUMBLE_CHANCE / 2
const SLIP_MISS = (1 + LIFT_FUMBLE_CHANCE) / 2

/** Пауза в хвосте фазы: её выдерживает каждая фаза цикла. */
const PAUSE = `wait:${PHASE_PAUSE_MS}`

/** Возврат клешни в покой. */
const RETURN = [`moveTo:${FIELD_CENTER.x},${FIELD_CENTER.y}`]

/** Начало цикла: спуск до верха стопки и сжатие клешни — они одинаковы при любом исходе. */
const approach = (cycle: Cycle): string[] => [
  `descend:${cycle.heap.getSurfaceHeight(getHomeCell())}`,
  PAUSE,
  'grab',
]

const runCycle = async (cycle: Cycle): Promise<void> => {
  cycle.requestDrop()
  await cycle.waitForPhase(PhaseName.descending)
  await cycle.waitForPhase(PhaseName.idle)
}

describe('цикл клешни', () => {
  let cycle: Cycle | undefined

  afterEach(async () => {
    await cycle?.stop()
    cycle = undefined
  })

  it('начинает работу в покое над наполненным кубом', async () => {
    cycle = await startCycle()

    expect(cycle.store.phase).toBe(PhaseName.idle)
    expect(cycle.store.canDrop).toBe(true)
    expect(cycle.store.collected).toBe(0)
    expect(cycle.log).toEqual([])
    expect(countToys(cycle)).toBeGreaterThan(0)
  })

  it('доносит захваченную игрушку до лотка и пополняет счётчик', async () => {
    cycle = await startCycle()

    const steps = approach(cycle)
    const before = countToys(cycle)
    const expected = cycle.heap.getTopBody(getHomeCell())

    cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS]

    await runCycle(cycle)

    expect(cycle.log).toEqual([
      ...steps,
      PAUSE,
      'ascend',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_RELEASE_MS}`,
      `wait:${PRIZE_PAUSE_MS}`,
      'prize:open',
      `wait:${PRIZE_OPEN_HOLD_MS}`,
      'prize:take',
      'prize:close',
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(1)
    expect(countToys(cycle)).toBe(before - 1)
    expect(cycle.prizes).toEqual([
      {
        shape: expected?.shape,
        color: expected?.color,
        collected: 1,
        domainCollected: 1,
      },
    ])
  })

  it('на промахе всё равно доезжает до лотка и счётчик не трогает', async () => {
    cycle = await startCycle()

    const steps = approach(cycle)
    const before = countToys(cycle)

    cycle.world.rolls = [getGrabRolls(cycle).miss]

    await runCycle(cycle)

    expect(cycle.log).toEqual([
      ...steps,
      PAUSE,
      'ascend',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
    expect(countToys(cycle)).toBe(before)
  })

  it('не берёт игрушку из пустой ячейки, даже когда бросок удачен', async () => {
    cycle = await startCycle()
    emptyHeap(cycle)
    cycle.world.rolls = [0]

    await runCycle(cycle)

    // Ячейка пуста: клешня села на пол, брать оказалось нечего и она ушла к лотку ни с чем
    expect(cycle.log).toEqual([
      'descend:0',
      PAUSE,
      'grab',
      PAUSE,
      'ascend',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
  })

  it('роняет игрушку на подъёме и доезжает до лотка пустой', async () => {
    cycle = await startCycle()

    const steps = approach(cycle)
    const before = countToys(cycle)

    cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_HIT, 0.5]

    await runCycle(cycle)

    // Игрушка выскальзывает прямо на ходу вверх и возвращается в кучу
    expect(cycle.log).toEqual([
      ...steps,
      PAUSE,
      'ascend slip',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
    expect(countToys(cycle)).toBe(before)
  })

  it('роняет игрушку на ходу, не прерывая путь клешни к лотку', async () => {
    cycle = await startCycle()

    const steps = approach(cycle)
    const before = countToys(cycle)

    cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_HIT, 0.5]

    await runCycle(cycle)

    // Из {4,4} к лотку путь идёт по ячейкам бокса {3,4} и {2,5}; бросок 0.5 выбирает вторую.
    // Ход к лотку один: клешня разжимается прямо в нём
    expect(cycle.log).toEqual([
      ...steps,
      PAUSE,
      'ascend',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y} drop:2,5`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
    expect(countToys(cycle)).toBe(before)
  })

  it('не останавливает клешню на потере: ход к лотку остаётся единственным', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_HIT, 0.5]

    await runCycle(cycle)

    const travels = cycle.log.filter((entry) => entry.startsWith('carryTo:') || entry.startsWith('moveTo:'))

    // Один ход к лотку и один возврат: промежуточной остановки в точке потери нет
    expect(travels).toEqual([`carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y} drop:2,5`, ...RETURN])
  })

  it('роняет игрушку только над ячейкой бокса, не над лотком', async () => {
    for (const pick of [0, 0.25, 0.5, 0.75, 0.99]) {
      cycle = await startCycle()
      cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_HIT, pick]

      await runCycle(cycle)

      const carried = cycle.log.find((entry) => entry.includes(' drop:')) as string
      const [col, row] = carried.slice(carried.indexOf(' drop:') + ' drop:'.length).split(',').map(Number)

      expect(isTrayCell({ col, row })).toBe(false)
      // Потерянная игрушка в счётчик не идёт, но сама клешня доезжает до лотка пустой
      expect(cycle.log.some((entry) => entry.startsWith(`carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`))).toBe(true)
      expect(cycle.store.collected).toBe(0)

      await cycle.stop()
      cycle = undefined
    }
  })

  it('игнорирует опускание посреди цикла', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [getGrabRolls(cycle).miss]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    // Запрос в обход погашенной кнопки: второй цикл он запустить не должен
    cycle.requestDrop()

    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log.filter((entry) => entry.startsWith('descend'))).toHaveLength(1)
  })

  it('принимает следующее опускание после возврата в покой', async () => {
    cycle = await startCycle()

    for (let round = 0; round < 2; round++) {
      cycle.world.rolls = [getGrabRolls(cycle).hit, SLIP_MISS, FUMBLE_MISS]

      await runCycle(cycle)
    }

    // Второй цикл принят; засчитано ровно столько, сколько клешня донесла — взять она может не всегда,
    // потому что первая игрушка могла оказаться в ячейке единственной
    expect(cycle.log.filter((entry) => entry.startsWith('descend'))).toHaveLength(2)
    expect(cycle.store.collected).toBe(cycle.prizes.length)
  })

  it('не оставляет подписок после остановки автомата', async () => {
    cycle = await startCycle()

    const { emitter } = cycle

    // Пока игра в покое, ожидание фазы — единственная живая подписка
    expect(emitter.listenerCounts()['ui:dropRequested'] ?? 0).toBe(1)

    await cycle.stop()
    cycle = undefined

    expect(emitter.listenerCounts()['ui:dropRequested'] ?? 0).toBe(0)
  })
})
