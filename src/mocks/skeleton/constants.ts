import { SYMBOL_SPRITES } from 'src/game/assets'
import { SYMBOL_SKELETONS } from 'src/game/constants'
import type { SymbolKey } from 'src/types/game'

import type { StubAnimationData, StubSkeletonData } from './types'

// База стаб-скелетов: описание на каждое имя скелета, которым оперирует SpinePool.

/** Слот с артом символа. */
const ART_SLOT = 'art'
/** Длительность выигрышного пульса, с. */
const WIN_DURATION = 0.6
/** Пик масштаба на пульсе. */
const WIN_SCALE = 1.15

/** Выигрыш: арт разъезжается и возвращается. Ставится с петлёй — идёт, пока держится поза `win`. */
const WIN_ANIMATION: StubAnimationData = {
  duration: WIN_DURATION,
  timelines: [
    {
      slot: ART_SLOT,
      property: 'scale',
      keys: [
        { time: 0, value: 1 },
        { time: WIN_DURATION / 2, value: WIN_SCALE },
        { time: WIN_DURATION, value: 1 },
      ],
    },
  ],
}

// Скелет рисует тот же арт покоя и в тех же единицах ячейки, что и спрайт: масштаб уже стоит
// на контейнере SymbolAnimation, поправка позиции слоту не нужна
const symbolSkeleton = (key: SymbolKey): StubSkeletonData => ({
  slots: [{ name: ART_SLOT, texture: SYMBOL_SPRITES[key].idle }],
  animations: { win: WIN_ANIMATION },
})

const symbolEntries = Object.entries(SYMBOL_SKELETONS) as [SymbolKey, string][]

/** Описание скелета по его имени. */
export const STUB_SKELETONS: ReadonlyMap<string, StubSkeletonData> = new Map<string, StubSkeletonData>(
  symbolEntries.map(([key, skeleton]): [string, StubSkeletonData] => [skeleton, symbolSkeleton(key)])
)
