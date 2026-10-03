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
  /** Цвет глифов: в нём растеризуется TTF и перекрашиваются PNG-глифы. Без него TTF белый, под `tint`, PNG — в своих цветах. */
  readonly color?: string
  /** Цвет контура-свечения толщиной 1 px вокруг глифов. */
  readonly outline?: string
}

/** Параметры шрифта из файла `font.json` папки `{bmfont}`. */
export type FontSpec = FontStyle & {
  /** Размер кегля в пикселях: столько пикселей занимает em шрифта. */
  readonly size?: number
  readonly chars?: string
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

/** Вектор модели в пикселях арта: `a` — вправо, `b` — вверх, `d` — вглубь, от игрока. */
export type ModelVector = readonly [a: number, b: number, d: number]

/** Точка модели в плоскости экрана `(a, b)`. */
export type ModelPlanePoint = readonly [a: number, b: number]

/** Цвет модели: рампа палитры и ступень. */
export type ModelColor = readonly [ramp: string, step: number]

/** Часть модели: эллипсоид из одной рампы палитры. */
export type ModelPart = {
  readonly name: string
  /** Группа частей, которую поза сдвигает целиком, например голова с ушами и мордой. */
  readonly group?: string
  readonly center: ModelVector
  readonly radii: ModelVector
  readonly ramp: string
  /** Ступень освещённой части; на свету — на ступень светлее, в тени — на ступень темнее. */
  readonly base: number
  /** Ступень контура силуэта. */
  readonly outline: number
  /** Ступень шва с частью той же рампы, лежащей глубже; без поля шов не рисуется. */
  readonly seam?: number
}

/**
 * Сдвиг группы частей в позе, в плоскости `(a, b)`: масштаб и поворот по часовой стрелке вокруг опорной точки, затем
 * смещение. Глубину поза не меняет.
 */
export type ModelTransform = {
  readonly pivot?: ModelPlanePoint
  readonly scale?: ModelPlanePoint
  /** Поворот по часовой стрелке, в градусах. */
  readonly angle?: number
  readonly offset?: ModelPlanePoint
}

/** Поза модели: сдвиги групп по имени; группа без сдвига остаётся в покое. */
export type ModelPose = Readonly<Record<string, ModelTransform>>

/** Кадр рендера модели: поза и крен по часовой стрелке в градусах. */
export type ModelFrame = {
  readonly pose: ModelPose
  readonly roll: number
}

/** Попадание луча в часть: точка и нормаль в системе части в покое, по ним модель рисует детали поверхности. */
export type ModelHit = {
  readonly part: ModelPart
  readonly point: ModelVector
  readonly normal: ModelVector
}

/** Модель игрушки для рендера лучом: эллипсоиды и детали поверхности. */
export type ToyModel = {
  readonly parts: readonly ModelPart[]
  /** Шов рисуется, когда соседняя часть той же рампы глубже на это число пикселей. */
  readonly seamDepth: number
  /** Цвет детали поверхности в точке попадания; без детали — `undefined`, и цвет задаёт свет. */
  readonly decal?: (hit: ModelHit) => ModelColor | undefined
}

/** Свет рендера модели: направление на источник в системе экрана и пороги смены ступени. */
export type ModelLight = {
  /** Единичный вектор: x — вправо, y — вверх, d — вглубь. */
  readonly direction: ModelVector
  /** Выше порога косинуса — ступень светлее. */
  readonly lit: number
  /** Ниже порога косинуса — ступень темнее. */
  readonly shade: number
}

/** Проекция, свет и кадр рендера модели. */
export type ModelRenderOptions = {
  readonly ramps: Palette['ramps']
  /** Сторона квадратного кадра; опорная точка модели — центр кадра. */
  readonly frame: number
  /** Сдвиг точки на экране на пиксель глубины: x — вправо, y — вверх. */
  readonly depthShift: ModelPlanePoint
  readonly light: ModelLight
}
