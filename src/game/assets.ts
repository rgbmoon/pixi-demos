import { Assets, type UnresolvedAsset } from 'pixi.js'
import { SymbolKey } from 'src/types/game'

// Единый манифест игровых ассетов: все URL в одном месте. `preloadGameAssets` грузит их
// одним `Assets.load` на бутстрапе, до материализации сцены; классы читают их из кэша
// синхронно (`Spine.from` / `Assets.get`). Другого `Assets.load` в проекте нет.

export type SpineAsset = {
  skeletonUrl: string
  atlasUrl: string
}

/** Спрайты одной ячейки: покой и размытие на прокрутке. Покоя может не быть — см. SYMBOL_SPRITES. */
export type SymbolSprites = {
  idle?: string
  blur: string
}

const ANIMATIONS_DIR = '/game-assets/animations'
const GRAPHIC_DIR = '/game-assets/graphic'

// Номер ассета на ключ символа.
const SYMBOL_NUMBERS: Record<SymbolKey, number> = {
  [SymbolKey.S]: 1,
  [SymbolKey.W]: 2,
  [SymbolKey.A]: 3,
  [SymbolKey.E]: 4,
  [SymbolKey.F]: 5,
  [SymbolKey.K]: 6,
  [SymbolKey.L]: 8,
  [SymbolKey.M]: 9,
  [SymbolKey.N]: 10,
  [SymbolKey.O]: 11,
  [SymbolKey.P]: 12,
}

const symbolEntries = Object.entries(SYMBOL_NUMBERS) as [SymbolKey, number][]

/** Скелеты символов: единственная анимация в них — `win`, `idle` и `blur` идут спрайтами. */
export const SYMBOL_ASSETS = Object.fromEntries(
  symbolEntries.map(([key, number]) => [
    key,
    {
      skeletonUrl: `${ANIMATIONS_DIR}/symbols/symbol_${number}/symbol-${number}.json`,
      atlasUrl: `${ANIMATIONS_DIR}/symbols/symbol_${number}/symbol-${number}.atlas`,
    },
  ])
) as Record<SymbolKey, SpineAsset>

// У wild спрайта покоя нет: в него впечатана карточка-рамка, снятая со скелета.
// Покой такому символу даёт setup-поза скелета — см. SymbolAnimation
const WITHOUT_IDLE_SPRITE: SymbolKey[] = [SymbolKey.W]

export const SYMBOL_SPRITES = Object.fromEntries(
  symbolEntries.map(([key, number]) => [
    key,
    {
      idle: WITHOUT_IDLE_SPRITE.includes(key)
        ? undefined
        : `${GRAPHIC_DIR}/symbols/symbol_${number}/single-symbol-${number}.webp`,
      blur: `${GRAPHIC_DIR}/symbols/symbol_${number}/symbol-${number}-blur.webp`,
    },
  ])
) as Record<SymbolKey, SymbolSprites>

/** Подложка ячейки: общая для всех символов, меняется вместе с позой. */
export const SYMBOL_BG_SRC = `${GRAPHIC_DIR}/symbols/symbol-bg.webp`
export const SYMBOL_BG_BLUR_SRC = `${GRAPHIC_DIR}/symbols/symbol-bg-blur.webp`

export const REELS_FRAME_SRC = `${GRAPHIC_DIR}/reels/reels-bg.webp`

/** Фон сцены: один скелет на два слоя — `background-back` за машиной и `background-front` перед ней. */
export const BACKGROUND_ASSET: SpineAsset = {
  skeletonUrl: `${ANIMATIONS_DIR}/background/background.json`,
  atlasUrl: `${ANIMATIONS_DIR}/background/background.atlas`,
}

// Скелет символа поднимается только под выигрышную анимацию, поэтому пик спроса на ключ —
// сколько выигравших ячеек одного вида показывается разом; при нехватке пул дорастает сам
const SYMBOL_POOL_SIZE = 3

/** Сколько инстансов каждого скелета `SpinePool` держит наготове после прогрева. */
export const SPINE_WARM_UP: { asset: SpineAsset; count: number }[] = [
  ...Object.values(SYMBOL_ASSETS).map((asset) => ({ asset, count: SYMBOL_POOL_SIZE })),
  // Задний и передний слой фона — два инстанса одного скелета
  { asset: BACKGROUND_ASSET, count: 2 },
]

export const PLATE_SRC = `${GRAPHIC_DIR}/buttons/plate-bg.svg`
export const WIN_LINE_SRC = `${GRAPHIC_DIR}/win-line/winline.png`

const BUTTONS_DIR = `${GRAPHIC_DIR}/buttons`

type ButtonBacking = {
  normal: string
  active: string
}

export const BUTTON_BACKINGS: Record<'md' | 'lg', { romb: ButtonBacking; circle: ButtonBacking }> = {
  md: {
    romb: {
      normal: `${BUTTONS_DIR}/button-romb-bg.svg`,
      active: `${BUTTONS_DIR}/button-romb-bg-active.svg`,
    },
    circle: {
      normal: `${BUTTONS_DIR}/button-circle-bg.svg`,
      active: `${BUTTONS_DIR}/button-circle-bg-active.svg`,
    },
  },
  lg: {
    romb: {
      normal: `${BUTTONS_DIR}/button-romb-bg-lg.svg`,
      active: `${BUTTONS_DIR}/button-romb-bg-active-lg.svg`,
    },
    circle: {
      normal: `${BUTTONS_DIR}/button-circle-bg-lg.svg`,
      active: `${BUTTONS_DIR}/button-circle-bg-active-lg.svg`,
    },
  },
}

const ICONS_DIR = `${GRAPHIC_DIR}/icons`

export const BUTTON_ICONS = {
  spin: `${ICONS_DIR}/arrow-cycle-svgrepo-com.svg`,
  soundOn: `${ICONS_DIR}/sound-on-svgrepo-com.svg`,
  soundOff: `${ICONS_DIR}/sound-off-svgrepo-com.svg`,
  plus: `${ICONS_DIR}/plus-svgrepo-com.svg`,
  minus: `${ICONS_DIR}/minus-svgrepo-com.svg`,
}

export const FONT_FAMILY = 'Roboto'

const FONT_SOURCE: UnresolvedAsset = {
  src: `${GRAPHIC_DIR}/fonts/Roboto-Regular.woff`,
  data: { family: FONT_FAMILY },
}

const spineSources = [...Object.values(SYMBOL_ASSETS), BACKGROUND_ASSET].flatMap(({ skeletonUrl, atlasUrl }) => [
  skeletonUrl,
  atlasUrl,
])

const symbolSpriteSources = Object.values(SYMBOL_SPRITES).flatMap(({ idle, blur }) => (idle ? [idle, blur] : [blur]))

const buttonSources = [
  ...Object.values(BUTTON_BACKINGS).flatMap(({ romb, circle }) => [
    romb.normal,
    romb.active,
    circle.normal,
    circle.active,
  ]),
  ...Object.values(BUTTON_ICONS),
]

const GAME_SOURCES: (string | UnresolvedAsset)[] = [
  ...new Set([
    ...spineSources,
    ...symbolSpriteSources,
    SYMBOL_BG_SRC,
    SYMBOL_BG_BLUR_SRC,
    REELS_FRAME_SRC,
    PLATE_SRC,
    WIN_LINE_SRC,
    ...buttonSources,
  ]),
  FONT_SOURCE,
]

/** Грузит все игровые ассеты в кэш Assets одним запросом. */
export async function preloadGameAssets(): Promise<void> {
  await Assets.load(GAME_SOURCES)
}
