import { Assets, type UnresolvedAsset } from 'pixi.js'
import { SymbolKey } from 'src/games/slot/types'

// Единый манифест игровых ассетов: все URL в одном месте. `preloadGameAssets` грузит их
// одним `Assets.load` на бутстрапе, до материализации сцены; классы читают их из кэша
// синхронно (`Assets.get`). Другого `Assets.load` в проекте нет.

/** Спрайты одной ячейки: покой и размытие на прокрутке. */
export type SymbolSprites = {
  idle: string
  blur: string
}

const GRAPHIC_DIR = '/games/slot/graphic'

// Растровый арт лежит парами `.webp` + запасной формат, поэтому читается по алиасу: в `src` идёт
// мультиформатный шаблон, из которого резолвер берёт поддерживаемое браузером расширение.

/**
 * Тир растрового пака: у символов и рамки барабанов есть папки `1` и `2` с одним и тем же артом
 * в однократном и двукратном размере. Тир выбирается один раз, дальше `data.resolution` держит
 * логический размер текстуры в единицах 1x — геометрия сцены от выбора не зависит.
 */
const TIER = window.devicePixelRatio > 1 ? 2 : 1

const symbolKeys = Object.keys(SymbolKey)

export const SYMBOL_SPRITES = Object.fromEntries(
  symbolKeys.map((key) => [key, { idle: `symbol-${key}-idle`, blur: `symbol-${key}-blur` }])
) as Record<SymbolKey, SymbolSprites>

const symbolSources: UnresolvedAsset[] = symbolKeys.flatMap((key) => {
  const dir = `${GRAPHIC_DIR}/symbols/symbol_${key}/${TIER}`

  return [
    { alias: SYMBOL_SPRITES[key as SymbolKey].idle, src: `${dir}/symbol-${key}.{webp,png}`, data: { resolution: TIER } },
    {
      alias: SYMBOL_SPRITES[key as SymbolKey].blur,
      src: `${dir}/symbol-${key}-blur.{webp,png}`,
      data: { resolution: TIER },
    },
  ]
})

export const REELS_FRAME_ALIAS = 'reels-bg'

const REELS_FRAME_SOURCE: UnresolvedAsset = {
  alias: REELS_FRAME_ALIAS,
  src: `${GRAPHIC_DIR}/reels/${TIER}/reels-bg.{webp,png}`,
  data: { resolution: TIER },
}

/** Фон сцены: обычный режим и режим фриспинов. Тиров у фона нет, арт нарисован в размер макета. */
export const BACKGROUND_ALIASES = {
  default: 'bg-default',
  fs: 'bg-fs',
}

const BACKGROUND_SOURCES: UnresolvedAsset[] = [
  { alias: BACKGROUND_ALIASES.default, src: `${GRAPHIC_DIR}/background/bg_default.{webp,jpg}` },
  { alias: BACKGROUND_ALIASES.fs, src: `${GRAPHIC_DIR}/background/bg_fs.{webp,jpg}` },
]

export const LOGO_ALIAS = 'logo'

const LOGO_SOURCE: UnresolvedAsset = {
  alias: LOGO_ALIAS,
  src: `${GRAPHIC_DIR}/logo/logo.{webp,png}`,
}

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
  ...new Set([PLATE_SRC, WIN_LINE_SRC, ...buttonSources]),
  ...symbolSources,
  REELS_FRAME_SOURCE,
  ...BACKGROUND_SOURCES,
  LOGO_SOURCE,
  FONT_SOURCE,
]

/** Грузит все игровые ассеты в кэш Assets одним запросом. */
export async function preloadGameAssets(): Promise<void> {
  await Assets.load(GAME_SOURCES)
}
