import { Assets, type Spritesheet } from 'pixi.js'

// Единый манифест ассетов toybox: все URL в одном месте. Атласы и шрифты собирает `pnpm assets` из
// `games/toybox/art/`; `preloadGameAssets` грузит их одним `Assets.load` до сборки сцены, классы читают их из
// кэша синхронно (`Assets.get`).

const ASSETS_DIR = '/games/toybox/assets'

/** Алиас атласа фона в кэше Assets. */
export const ROOM_ATLAS = 'room'

/** Последовательности атласа фона: кадры `<имя>-N` упаковщик собирает в `animations.<имя>`. */
export const ROOM_SEQUENCES = {
  /** Варианты декалей стены. */
  decals: 'decal',
  /** Кадры пульса обоев. */
  wallpaper: 'wallpaper',
} as const

/** Алиас атласа корпуса в кэше Assets. */
export const CABINET_ATLAS = 'cabinet'

/** Алиас атласа внутренностей куба в кэше Assets. */
export const BOX_ATLAS = 'box'

/** Атласы игры: алиас в кэше Assets → URL JSON атласа. */
export const ATLASES = {
  [ROOM_ATLAS]: `${ASSETS_DIR}/room/room.json`,
  [CABINET_ATLAS]: `${ASSETS_DIR}/cabinet/cabinet.json`,
  [BOX_ATLAS]: `${ASSETS_DIR}/box/box.json`,
} as const

/**
 * Кадры атласа корпуса: плоские рисунки граней, собранные пайпом `compose`. Ключ совпадает с ключом грани в
 * `getCabinetFaces`, имя кадра — с именем папки деталей и раскладки грани.
 */
export const CABINET_FRAMES = {
  cabinetFront: 'cabinet-front.png',
  cabinetSide: 'cabinet-side.png',
  panel: 'panel.png',
  marqueeFront: 'marquee-front.png',
  marqueeScreen: 'marquee-screen.png',
  marqueeSide: 'marquee-side.png',
  marqueeRoof: 'marquee-roof.png',
} as const

/** Кадры стоек куба: ключ совпадает с ключом стойки в `getPillarFaces`. */
export const PILLAR_FRAMES = {
  frontLeft: 'pillar-front-left.png',
  frontRight: 'pillar-front-right.png',
  backLeft: 'pillar-back-left.png',
  backRight: 'pillar-back-right.png',
} as const

/**
 * Кадры атласа внутренностей куба: плоские рисунки граней, собранные пайпом `compose`. Ключ совпадает с ключом грани
 * в `getCubeFaces`.
 */
export const BOX_FRAMES = {
  glass: 'glass.png',
  floor: 'floor.png',
  chute: 'chute.png',
  trayBack: 'tray-back.png',
  traySide: 'tray-side.png',
} as const

/** Кадры атласа фона: ключи текстур в кэше Assets. */
export const ROOM_FRAMES = {
  wainscot: 'wainscot.png',
  carpet: 'carpet.png',
  wallGlow: 'glow.png',
  shadow: 'shadow.png',
} as const

/**
 * Грузит атласы в кэш Assets. Каждому атласу после загрузки ставится выборка ближайшего пикселя (`nearest`):
 * пиксель-арт рисуется целым масштабом без сглаживания. `TextureSource.defaultOptions` не меняется, потому что
 * его использует и слот.
 */
export async function preloadGameAssets(): Promise<void> {
  const sheets = await Assets.load<Spritesheet>(Object.entries(ATLASES).map(([alias, src]) => ({ alias, src })))

  for (const sheet of Object.values(sheets)) sheet.textureSource.scaleMode = 'nearest'
}
