import { Assets, BitmapFont, type Spritesheet } from 'pixi.js'

import type { ButtonFrames, LampColor, PrizeLight } from './types'

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

/** Алиас атласа клешни в кэше Assets. */
export const CLAW_ATLAS = 'claw'

/** Алиас атласа органов управления в кэше Assets. */
export const HUD_ATLAS = 'hud'

/** Алиас атласа окна выдачи в кэше Assets. */
export const HATCH_ATLAS = 'hatch'

/** Атласы игры: алиас в кэше Assets → URL JSON атласа. */
export const ATLASES = {
  [ROOM_ATLAS]: `${ASSETS_DIR}/room/room.json`,
  [CABINET_ATLAS]: `${ASSETS_DIR}/cabinet/cabinet.json`,
  [BOX_ATLAS]: `${ASSETS_DIR}/box/box.json`,
  [CLAW_ATLAS]: `${ASSETS_DIR}/claw/claw.json`,
  [HUD_ATLAS]: `${ASSETS_DIR}/hud/hud.json`,
  [HATCH_ATLAS]: `${ASSETS_DIR}/hatch/hatch.json`,
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

/**
 * Кадры лампы табло в атласе корпуса: погашенная лампа общая, у каждого цвета — полнакала, полный свет и ореол. Якорь
 * кадров — центр лампы.
 */
export const LAMP_FRAMES = {
  off: 'lamp-off.png',
  colors: {
    yellow: { dim: 'lamp-yellow-dim.png', on: 'lamp-yellow-on.png', halo: 'lamp-halo-yellow.png' },
    magenta: { dim: 'lamp-magenta-dim.png', on: 'lamp-magenta-on.png', halo: 'lamp-halo-magenta.png' },
    red: { dim: 'lamp-red-dim.png', on: 'lamp-red-on.png', halo: 'lamp-halo-red.png' },
  },
} as const satisfies { off: string; colors: Record<LampColor, { dim: string; on: string; halo: string }> }

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

/**
 * Кадры атласа клешни: трос — бесшовный по вертикали тайл, остальные — промежуточные позы захвата и разжатия: замах
 * шире раскрытой, треть и две трети смыкания. Якорь поз — точка крепления троса.
 */
export const CLAW_FRAMES = {
  rope: 'rope.png',
  wide: 'claw-wide.png',
  third: 'claw-third.png',
  twoThirds: 'claw-two-thirds.png',
} as const

/**
 * Последовательности атласа клешни: кадры поворота RotSprite раскрытой и сжатой клешни с шагом `CLAW_TILT_STEP` от
 * наклона влево до наклона вправо, кадр без наклона посередине. Якорь кадра — точка крепления троса.
 */
export const CLAW_SEQUENCES = {
  open: 'claw-open',
  closed: 'claw-closed',
} as const

/**
 * Кадры атласа органов управления, нарисованные в экранной проекции: наклон панели у кнопки Drop и основания
 * джойстика заложен в рисунок. Якорь Drop и основания — центр основания, шара и кнопки сброса — их центр. Облако
 * диалога — кадр 9-slice, хвост облака смотрит остриём вниз-влево.
 */
export const HUD_FRAMES = {
  drop: { normal: 'drop.png', pressed: 'drop-pressed.png' },
  reset: { normal: 'reset.png', pressed: 'reset-pressed.png' },
  joystickBase: 'joystick-base.png',
  joystickBall: 'joystick-ball.png',
  joystickStick: 'joystick-stick.png',
  bubble: 'bubble.png',
  bubbleTail: 'bubble-tail.png',
} as const satisfies Record<string, string | ButtonFrames>

/**
 * Последовательности атласа органов управления: стрелки тура одного рисунка. Стрелки джойстика стоят вокруг шара вдоль
 * осей панели, якорь — центр основания; стрелка Drop висит над кнопкой, якорь — середина нижнего края кадра.
 */
export const HUD_SEQUENCES = {
  tourJoystick: 'tour-joystick',
  tourDrop: 'tour-drop',
} as const

/**
 * Кадры атласа окна выдачи, плоские рисунки в плоскости фасада: обод с прозрачным проёмом и ниша при каждом состоянии
 * света. Углы кадров в мире — `getPrizeHatchFaces`.
 */
export const HATCH_FRAMES = {
  rim: 'rim.png',
  niche: { off: 'niche-off.png', dim: 'niche-dim.png', on: 'niche-on.png' },
} as const satisfies { rim: string; niche: Record<PrizeLight, string> }

/** Последовательности атласа окна выдачи: видимая в проёме часть шторки от закрытой до открытой. */
export const HATCH_SEQUENCES = {
  door: 'door',
} as const

/** Кадры атласа фона: ключи текстур в кэше Assets. */
export const ROOM_FRAMES = {
  wainscot: 'wainscot.png',
  carpet: 'carpet.png',
  wallGlow: 'glow.png',
  shadow: 'shadow.png',
} as const

/**
 * Семейства пиксельного шрифта для `BitmapText`: оба собраны из одного набора глифов 5×7. Табло — оранжевый текст,
 * облако диалога — тёмный.
 */
export const FONT_FAMILIES = {
  marquee: 'pixel-marquee',
  dialog: 'pixel-dialog',
} as const

/**
 * Грузит атласы и шрифты в кэш Assets. Каждому атласу и странице шрифта после загрузки ставится выборка ближайшего
 * пикселя (`nearest`): пиксель-арт рисуется целым масштабом без сглаживания. `TextureSource.defaultOptions` не
 * меняется, потому что его использует и слот.
 */
export async function preloadGameAssets(): Promise<void> {
  const assets = await Assets.load<Spritesheet | BitmapFont>([
    ...Object.entries(ATLASES).map(([alias, src]) => ({ alias, src })),
    ...Object.values(FONT_FAMILIES).map((family) => ({ alias: family, src: `${ASSETS_DIR}/fonts/${family}.fnt` })),
  ])

  for (const asset of Object.values(assets)) {
    const sources =
      asset instanceof BitmapFont ? asset.pages.map(({ texture }) => texture.source) : [asset.textureSource]

    for (const source of sources) source.scaleMode = 'nearest'
  }
}
