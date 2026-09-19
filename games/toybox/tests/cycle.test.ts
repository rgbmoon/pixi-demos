// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { FIELD_CENTER, TRAY_CENTER } from '#src/constants'
import { PhaseName } from '#src/types'

import { type Cycle, startCycle } from './setup/cycle'

/** Движения полного цикла в порядке, в котором их запрашивают фазы. */
const FULL_CYCLE = [
  'descend',
  'ascend',
  `moveTo:${TRAY_CENTER.x},${TRAY_CENTER.y}`,
  'hold',
  `moveTo:${FIELD_CENTER.x},${FIELD_CENTER.y}`,
]

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
    expect(cycle.log).toEqual([])
  })

  it('проводит клешню от опускания до возврата в покой', async () => {
    cycle = await startCycle()

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log).toEqual(FULL_CYCLE)
  })

  it('игнорирует опускание посреди цикла', async () => {
    cycle = await startCycle()

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    // Запрос в обход погашенной кнопки: второй цикл он запустить не должен
    cycle.requestDrop()

    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log).toEqual(FULL_CYCLE)
  })

  it('принимает следующее опускание после возврата в покой', async () => {
    cycle = await startCycle()

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    cycle.requestDrop()
    await cycle.waitForPhase(PhaseName.descending)
    await cycle.waitForPhase(PhaseName.idle)

    expect(cycle.log).toEqual([...FULL_CYCLE, ...FULL_CYCLE])
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
