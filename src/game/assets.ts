import { Assets, type UnresolvedAsset } from 'pixi.js'
import { SymbolKey } from 'src/types/game'

// Единый манифест игровых ассетов: все URL в одном месте. `preloadGameAssets` грузит их
// одним `Assets.load` на бутстрапе, до материализации сцены; классы читают их из кэша
// синхронно (`Spine.from` / `Assets.get`). Другого `Assets.load` в проекте нет.

export type SpineAsset = {
  skeletonUrl: string
  atlasUrl: string
}

const SYMBOLS_DIR = '/game-assets/animations/symbols'

export const SYMBOL_ASSETS: Record<SymbolKey, SpineAsset> = {
  [SymbolKey.K]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_1.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.L]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_2.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.M]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_3.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.N]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_4.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.O]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_5.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.P]: {
    skeletonUrl: `${SYMBOLS_DIR}/low/low_6.json`,
    atlasUrl: `${SYMBOLS_DIR}/low/1/low.atlas`,
  },
  [SymbolKey.E]: {
    skeletonUrl: `${SYMBOLS_DIR}/middle_1/middle_1.json`,
    atlasUrl: `${SYMBOLS_DIR}/middle_1/1/middle_1.atlas`,
  },
  [SymbolKey.F]: {
    skeletonUrl: `${SYMBOLS_DIR}/middle_2/middle_2.json`,
    atlasUrl: `${SYMBOLS_DIR}/middle_2/1/middle_2.atlas`,
  },
  [SymbolKey.A]: {
    skeletonUrl: `${SYMBOLS_DIR}/high_1/high_1.json`,
    atlasUrl: `${SYMBOLS_DIR}/high_1/1/high_1.atlas`,
  },
  [SymbolKey.W]: {
    skeletonUrl: `${SYMBOLS_DIR}/wild/wild.json`,
    atlasUrl: `${SYMBOLS_DIR}/wild/1/wild.atlas`,
  },
  [SymbolKey.S]: {
    skeletonUrl: `${SYMBOLS_DIR}/scatter/scatter.json`,
    atlasUrl: `${SYMBOLS_DIR}/scatter/1/scatter.atlas`,
  },
}

const ANIMATIONS_DIR = '/game-assets/animations'

export const FRAME_ASSET: SpineAsset = {
  skeletonUrl: `${ANIMATIONS_DIR}/reels_frame/frame.json`,
  atlasUrl: `${ANIMATIONS_DIR}/reels_frame/1/frame.atlas`,
}

export const EFFECT_ASSETS = {
  winFrame: {
    skeletonUrl: `${ANIMATIONS_DIR}/win_frame/win_frame.json`,
    atlasUrl: `${ANIMATIONS_DIR}/win_frame/1/win_frame.atlas`,
  },
} satisfies Record<string, SpineAsset>

// Пик одновременного спроса на один ключ символа: ячеек в машине 20, ключей 11, ключ ленты
// случайный — распределение Binomial(20, 1/11), шесть и больше выпадает в 0.7% моментов
const SYMBOL_POOL_SIZE = 6

/** Сколько инстансов каждого скелета `SpinePool` держит наготове после прогрева. */
export const SPINE_WARM_UP: { asset: SpineAsset; count: number }[] = [
  ...Object.values(SYMBOL_ASSETS).map((asset) => ({ asset, count: SYMBOL_POOL_SIZE })),
  { asset: FRAME_ASSET, count: 1 },
]

const GRAPHIC_DIR = '/game-assets/graphic'

export const LOGO_SRC = `${GRAPHIC_DIR}/AL_Logo/AL_logo.png`
export const PLATE_SRC = `${GRAPHIC_DIR}/AL_Gamble_buttons/plate-bg.svg`

const BUTTONS_DIR = `${GRAPHIC_DIR}/AL_Gamble_buttons`

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

const ICONS_DIR = `${GRAPHIC_DIR}/Icons`

export const BUTTON_ICONS = {
  spin: `${ICONS_DIR}/arrow-cycle-svgrepo-com.svg`,
  soundOn: `${ICONS_DIR}/sound-on-svgrepo-com.svg`,
  soundOff: `${ICONS_DIR}/sound-off-svgrepo-com.svg`,
  autospinOn: `${ICONS_DIR}/square-svgrepo-com.svg`,
  autospinOff: `${ICONS_DIR}/play-svgrepo-com.svg`,
  betUp: `${ICONS_DIR}/plus-svgrepo-com.svg`,
  betDown: `${ICONS_DIR}/minus-svgrepo-com.svg`,
}

// Фон читается по алиасу (`Assets.get(BACKGROUND_ALIASES.light)`), т.к. src — мультиформат {webp,png}
export const BACKGROUND_ALIASES = {
  light: 'al_bg_reg',
  dark: 'al_bg_fs',
}

const BACKGROUND_SOURCES: UnresolvedAsset[] = [
  {
    alias: BACKGROUND_ALIASES.light,
    src: `${GRAPHIC_DIR}/AL_Background/AL_bg_reg.{webp,png}`,
  },
  {
    alias: BACKGROUND_ALIASES.dark,
    src: `${GRAPHIC_DIR}/AL_Background/AL_bg_fs.{webp,png}`,
  },
]

export const FONT_FAMILY = 'Tilt Warp'

const FONT_SOURCE: UnresolvedAsset = {
  src: `${GRAPHIC_DIR}/AL_Fonts/TiltWarp-Regular.ttf`,
  data: { family: FONT_FAMILY },
}

const spineSources = [...Object.values(SYMBOL_ASSETS), FRAME_ASSET, ...Object.values(EFFECT_ASSETS)].flatMap(
  ({ skeletonUrl, atlasUrl }) => [skeletonUrl, atlasUrl]
)

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
  ...new Set([...spineSources, LOGO_SRC, PLATE_SRC, ...buttonSources]),
  ...BACKGROUND_SOURCES,
  FONT_SOURCE,
]

/** Грузит все игровые ассеты в кэш Assets одним запросом. */
export async function preloadGameAssets(): Promise<void> {
  await Assets.load(GAME_SOURCES)
}
