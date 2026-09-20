// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  FIELD_CENTER,
  FUMBLE_CHANCE,
  GRAB_CHANCE,
  GRAB_HOLD_MS,
  LIFT_FUMBLE_CHANCE,
  PHASE_PAUSE_MS,
  TRAY_CENTER,
  TRAY_HOLD_MS,
  TRAY_RELEASE_MS,
} from '#src/constants'
import { PhaseName } from '#src/types'
import { isTrayCell } from '#src/utils'

import { type Cycle, startCycle } from './setup/cycle'

/** Сколько слоёв занято под клешнёй по умолчанию: столько дублёр кучи отдаёт `getStackHeight`. */
const STACK_HEIGHT = 3

/** Бросок, на котором захват удаётся, и бросок, на котором он проваливается. */
const GRAB_HIT = GRAB_CHANCE / 2
const GRAB_MISS = (1 + GRAB_CHANCE) / 2

/** Бросок, на котором клешня роняет игрушку, и бросок, на котором она её доносит. */
const FUMBLE_HIT = FUMBLE_CHANCE / 2
const FUMBLE_MISS = (1 + FUMBLE_CHANCE) / 2

/** Бросок, на котором игрушка выскальзывает при подъёме, и бросок, на котором она удерживается. */
const SLIP_HIT = LIFT_FUMBLE_CHANCE / 2
const SLIP_MISS = (1 + LIFT_FUMBLE_CHANCE) / 2

/** Пауза в хвосте фазы: её выдерживает каждая фаза цикла. */
const PAUSE = `wait:${PHASE_PAUSE_MS}`

/** Начало цикла: спуск до верха стопки и сжатие клешни — они одинаковы при любом исходе. */
const APPROACH = [`descend:${STACK_HEIGHT}`, PAUSE, `wait:${GRAB_HOLD_MS}`]

/** Возврат клешни в покой. */
const RETURN = [`moveTo:${FIELD_CENTER.x},${FIELD_CENTER.y}`]

describe('цикл клешни', () => {
  let cycle: Cycle | undefined

  afterEach(async () => {
    await cycle?.stop()
    cycle = undefined
  })

  it('начинает работу в покое', async () => {
    cycle = await startCycle()

    expect(cycle.store.phase).toBe(PhaseName.idle)
    expect(cycle.store.canDrop).toBe(true)
    expect(cycle.store.collected).toBe(0)
    expect(cycle.log).toEqual([])
  })

  it('доносит захваченную игрушку до лотка и пополняет счётчик', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_MISS]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log).toEqual([
      ...APPROACH,
      `take:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
      'hold',
      PAUSE,
      'ascend',
      'settle',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_RELEASE_MS}`,
      'release',
      'collect',
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(1)
  })

  it('на промахе всё равно доезжает до лотка и счётчик не трогает', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_MISS]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log).toEqual([
      ...APPROACH,
      PAUSE,
      'ascend',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
  })

  it('не берёт игрушку из пустой ячейки, даже когда бросок удачен', async () => {
    cycle = await startCycle()
    cycle.world.stackHeight = 0
    cycle.world.rolls = [GRAB_HIT]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    // Ячейка пуста: клешня села на пол, запросила игрушку и ушла к лотку ни с чем
    expect(cycle.log).toEqual([
      'descend:0',
      PAUSE,
      `wait:${GRAB_HOLD_MS}`,
      `take:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
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
    cycle.world.rolls = [GRAB_HIT, SLIP_HIT, 0.5]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    // Игрушка выскальзывает прямо на ходу вверх и падает в ту же ячейку, откуда её взяли
    expect(cycle.log).toEqual([
      ...APPROACH,
      `take:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
      'hold',
      PAUSE,
      'ascend slip',
      `drop:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
      'settle',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
  })

  it('роняет игрушку на ходу, не прерывая путь клешни к лотку', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_HIT, 0.5]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    // Из {4,4} к лотку путь идёт по ячейкам бокса {3,4} и {2,5}; бросок 0.5 выбирает вторую.
    // Ход к лотку один: клешня разжимается прямо в нём
    expect(cycle.log).toEqual([
      ...APPROACH,
      `take:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
      'hold',
      PAUSE,
      'ascend',
      'settle',
      PAUSE,
      `carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y} drop:2,5`,
      'drop:2,5',
      // Донести нечего: клешня разжимается над лотком вхолостую
      `wait:${TRAY_HOLD_MS}`,
      ...RETURN,
    ])
    expect(cycle.store.collected).toBe(0)
  })

  it('не останавливает клешню на потере: ход к лотку остаётся единственным', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_HIT, 0.5]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    const travels = cycle.log.filter((entry) => entry.startsWith('carryTo:') || entry.startsWith('moveTo:'))

    // Один ход к лотку и один возврат: промежуточной остановки в точке потери нет
    expect(travels).toEqual([`carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y} drop:2,5`, ...RETURN])
  })

  it('роняет игрушку только над ячейкой бокса, не над лотком', async () => {
    for (const pick of [0, 0.25, 0.5, 0.75, 0.99]) {
      cycle = await startCycle()
      cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_HIT, pick]

      cycle.requestDrop()
      await cycle.waitForPhase(PhaseName.descending)
      await cycle.waitForPhase(PhaseName.idle)

      const dropped = cycle.log.find((entry) => entry.startsWith('drop:')) as string
      const [col, row] = dropped.slice('drop:'.length).split(',').map(Number)

      expect(isTrayCell({ col, row })).toBe(false)
      // Потерянная игрушка в счётчик не идёт, но сама клешня доезжает до лотка пустой
      expect(cycle.log.some((entry) => entry.startsWith(`carryTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`))).toBe(true)
      expect(cycle.store.collected).toBe(0)

      await cycle.stop()
      cycle = undefined
    }
  })

  it('засчитывает игрушку, свалившуюся в лоток при падении', async () => {
    cycle = await startCycle()
    cycle.world.dropCollected = true
    cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_HIT, 0.5]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.store.collected).toBe(1)
  })

  it('игнорирует опускание посреди цикла', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_MISS]

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    // Запрос в обход погашенной кнопки: второй цикл он запустить не должен
    cycle.requestDrop()

    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log.filter((entry) => entry.startsWith('descend'))).toHaveLength(1)
  })

  it('принимает следующее опускание после возврата в покой', async () => {
    cycle = await startCycle()
    cycle.world.rolls = [GRAB_HIT, SLIP_MISS, FUMBLE_MISS, GRAB_HIT, SLIP_MISS, FUMBLE_MISS]

    for (let round = 0; round < 2; round++) {
      cycle.requestDrop()
      await cycle.waitForPhase(PhaseName.descending)
      await cycle.waitForPhase(PhaseName.idle)
    }

    expect(cycle.store.collected).toBe(2)
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
