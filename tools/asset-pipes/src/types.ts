import type { AssetPackConfig } from '@assetpack/core'

/** Растр RGBA: 4 байта на пиксель, строки сверху вниз. */
export type RasterImage = {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

/** Точка растра в пикселях арта: начало координат — левый верхний угол. */
export type RasterPoint = {
  x: number
  y: number
}

/** Цвет sRGB: каналы 0–255. */
export type Rgb = readonly [number, number, number]

/** Цвет в OKLab: светлота и две оси цветности. */
export type Lab = readonly [number, number, number]

/** Файл палитры: рампы от тёмной ступени к светлой, у всех рамп одно число ступеней. */
export type Palette = {
  readonly ramps: Readonly<Record<string, readonly string[]>>
}

/** Цвет палитры с адресом: рампа и ступень. */
export type PaletteEntry = {
  readonly ramp: string
  readonly step: number
  readonly rgb: Rgb
  readonly lab: Lab
}

/** Палитра, разложенная для поиска: цвета списком и по упакованному RGB. */
export type PaletteIndex = {
  readonly entries: readonly PaletteEntry[]
  readonly byColor: ReadonlyMap<number, PaletteEntry>
  readonly ramps: Readonly<Record<string, readonly PaletteEntry[]>>
}

/**
 * Альфа после приведения к палитре: `binary` — только 0 и 255, `keep` — как в исходнике,
 * число 0–1 — одна непрозрачность у всех непрозрачных пикселей.
 */
export type AlphaMode = 'binary' | 'keep' | number

/** Ширина неизменяемых краёв кадра для `NineSliceSprite`, в пикселях. */
export type FrameBorders = {
  left: number
  top: number
  right: number
  bottom: number
}

/** Сайдкар кадра `*.meta.json`: опорная точка в пикселях кадра и края 9-slice. */
export type FrameMeta = {
  pivot?: RasterPoint
  borders?: FrameBorders
}

export type FaceCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Декаль грани: имя детали, угол грани и отступ от него внутрь грани в пикселях. */
export type DecalPlacement = {
  readonly name: string
  readonly corner: FaceCorner
  readonly x: number
  readonly y: number
}

/** Раскладка грани для `compose`: размер в пикселях арта и декали. */
export type FaceLayout = {
  readonly width: number
  readonly height: number
  readonly decals?: readonly DecalPlacement[]
}

/** Размер прямоугольника в пикселях. */
export type RasterSize = {
  readonly width: number
  readonly height: number
}

/** Радиусы угасания света по горизонтали и отдельно вверх и вниз. */
export type LightSideRadius = {
  readonly x: number
  readonly top: number
  readonly bottom: number
}

/** Радиусы угасания света: общий, по осям или по сторонам. */
export type LightRadius = number | RasterPoint | LightSideRadius

/**
 * Параметры пятна света из файла `<имя>{light}.json`; ступени рампы — от тусклой к яркой. Источник `source` —
 * прямоугольник с центром в `center`: свет угасает от его края, без источника — от центра.
 */
export type LightSpot = {
  readonly width: number
  readonly height: number
  readonly center?: RasterPoint
  readonly source?: RasterSize
  readonly radius: LightRadius
  readonly ramp: string
  readonly steps: readonly [number, number]
  readonly alpha?: number
}

/** Цвета шрифта: общие в `font.json` или одного стиля из `styles`. */
export type FontStyle = {
  /** Цвет, в который перекрашиваются PNG-глифы; без него глифы остаются в своих цветах. */
  readonly color?: string
  /** Цвет контура-свечения толщиной 1 px вокруг глифов. */
  readonly outline?: string
}

/** Параметры шрифта из файла `font.json` папки `{bmfont}`. */
export type FontSpec = FontStyle & {
  /** Стили одного набора глифов: каждый собирается в свой BMFont `<папка>-<стиль>`, поля стиля заменяют общие. */
  readonly styles?: Readonly<Record<string, FontStyle>>
}

/** Глиф шрифта: растр и метрики в пикселях относительно начала строки. */
export type BitmapGlyph = {
  readonly id: number
  readonly image: RasterImage
  readonly xOffset: number
  readonly yOffset: number
  readonly xAdvance: number
}

/** Шрифт BMFont до записи: метрики строки и глифы. */
export type BitmapFontData = {
  readonly face: string
  readonly size: number
  readonly lineHeight: number
  readonly base: number
  readonly glyphs: readonly BitmapGlyph[]
}

/** Страница BMFont: растр и положение каждого глифа на нём. */
export type BitmapFontPage = {
  readonly image: RasterImage
  readonly positions: ReadonlyMap<number, RasterPoint>
}

/** Кадр в JSON атласа: поля встроенного упаковщика и поля, которые дописывает `frame-meta`. */
export type AtlasFrame = {
  frame: { x: number; y: number; w: number; h: number }
  rotated?: boolean
  trimmed?: boolean
  spriteSourceSize?: { x: number; y: number; w: number; h: number }
  sourceSize?: { w: number; h: number }
  anchor?: RasterPoint
  borders?: FrameBorders
}

/** JSON атласа встроенного упаковщика. */
export type AtlasJson = {
  frames: Record<string, AtlasFrame>
}

/** Конфиг сборки ассетов игры: каталоги, палитра и знания игры для пайпов. */
export type AssetBuildOptions = {
  /** Подробность отчёта AssetPack; по умолчанию `info`. */
  readonly logLevel?: AssetPackConfig['logLevel']
  /** Исходники арта. */
  readonly entry: string
  /** Каталог готовых атласов и шрифтов; удаляется в начале каждой сборки. */
  readonly output: string
  /** Каталог промежуточных файлов сборки. */
  readonly cacheDir: string
  /** Глобы путей внутри `entry`, которые сборка пропускает. */
  readonly ignore?: readonly string[]
  /** Мастер-палитра: в её цветах хранятся исходники. */
  readonly palette: Palette
  /** Палитра той же структуры, в цвета которой сборка переводит арт. */
  readonly targetPalette?: Palette
  /** Раскладки граней по имени папки `{compose}`. */
  readonly faces?: Readonly<Record<string, FaceLayout>>
  /** Цвет контура подсветки. */
  readonly outlineColor: string
  /** Каталог превью атласов и тайлов для ревью; без него превью не пишутся. */
  readonly previewDir?: string
}
