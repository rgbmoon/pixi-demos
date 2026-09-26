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

/**
 * Наклон растра грани в проекции игры: сдвиг столбца по вертикали на пиксель ширины и строки по горизонтали
 * на пиксель высоты.
 */
export type ShearSlopes = {
  readonly column: number
  readonly row: number
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

/** Параметры пятна света из файла `<имя>{light}.json`; ступени рампы — от тусклой к яркой. */
export type LightSpot = {
  readonly width: number
  readonly height: number
  readonly center?: RasterPoint
  readonly radius: number | RasterPoint
  readonly ramp: string
  readonly steps: readonly [number, number]
  readonly alpha?: number
}

/** Параметры шрифта из файла `font.json` папки `{bmfont}`. */
export type FontSpec = {
  /** Размер кегля в пикселях: столько пикселей занимает em шрифта. */
  readonly size?: number
  readonly chars?: string
  /** Цвет глифов TTF; по умолчанию белый, под `tint`. */
  readonly color?: string
  /** Цвет контура-свечения толщиной 1 px вокруг глифов. */
  readonly outline?: string
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

/** Кадр в JSON атласа: поля, которые читает и дописывает `frame-meta`. */
export type AtlasFrame = {
  sourceSize: { w: number; h: number }
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
  /** Наклоны граней по значению тега `{face=…}`. */
  readonly projections?: Readonly<Record<string, ShearSlopes>>
  /** Цвет контура подсветки. */
  readonly outlineColor: string
  /** Каталог превью атласов и тайлов для ревью; без него превью не пишутся. */
  readonly previewDir?: string
}
