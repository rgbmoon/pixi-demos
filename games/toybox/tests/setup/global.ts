import type { TestProject } from 'vitest/node'

import { pourHeap } from '#src/heap/utils'
import type { HeapSnapshotBody } from '#src/types'
import { createRandom } from '@pixi-demos/core/random'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Игра Toybox - позы покоя куч, насыпанных `pourHeap` по сиду: ключ — сид. */
    heaps: Record<number, HeapSnapshotBody[]>
  }
}

/** Сиды куч, общих для файлов прогона: 1–3 — образцы для проверок кучи и наложения, 7 — серия раундов. */
const HEAP_SEEDS = [1, 2, 3, 7]

/**
 * Насыпает общие кучи в главном процессе vitest до запуска файлов. Наполнение идёт сотни миллисекунд, и
 * внутри теста оно упиралось в `testTimeout` на загруженном раннере CI.
 */
export const setup = (project: TestProject): void => {
  project.provide('heaps', Object.fromEntries(HEAP_SEEDS.map((seed) => [seed, pourHeap(createRandom(seed))])))
}
