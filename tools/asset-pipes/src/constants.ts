/** Пиксель с альфой ниже порога приводится к прозрачному, остальные — к непрозрачным. */
export const ALPHA_THRESHOLD = 128

/** Увеличение перед поворотом RotSprite: три прохода Scale2x. */
export const ROTSPRITE_SCALE = 8

/** Число знаков после запятой, до которого округляются углы кадра поворота: убирает ошибку плавающей точки. */
export const ROTSPRITE_PRECISION = 9

/** Доля площади пикселя под непрозрачными пикселями исходника, с которой пиксель уменьшенного растра непрозрачен. */
export const DOWNSCALE_COVERAGE = 0.45

/** Радиус, в котором смягчение самого тёмного цвета ищет соседей из рамп палитры, px. */
export const SOFTEN_RADIUS = 2

/** Матрица Bayer 4×4 построчно: порядок порогов упорядоченного дизеринга. */
export const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const

/** Во сколько раз шов тайла может быть резче среднего перехода между соседними столбцами и строками. */
export const TILE_SEAM_RATIO = 2

/** Сколько раз тайл повторяется по каждой оси в превью. */
export const TILE_PREVIEW_REPEAT = 3

/** Во сколько раз увеличиваются превью атласов и тайлов. */
export const PREVIEW_SCALE = 4

/** Ширина страницы шрифта в пикселях. */
export const FONT_PAGE_WIDTH = 256

/** Отступ между глифами на странице шрифта: соседний глиф не попадает в выборку. */
export const FONT_PAGE_PADDING = 2

/** Расстояние между иконкой шрифта и следующим символом. */
export const FONT_ICON_SPACING = 1

/** Имя файла с параметрами шрифта в папке `{bmfont}`. */
export const FONT_SPEC_FILE = 'font.json'

/** Имена деталей набора грани для `compose`: файл детали называется так же. */
export const FACE_PARTS = {
  fill: 'fill',
  edgeTop: 'edge-top',
  edgeBottom: 'edge-bottom',
  edgeLeft: 'edge-left',
  edgeRight: 'edge-right',
  cornerTopLeft: 'corner-top-left',
  cornerTopRight: 'corner-top-right',
  cornerBottomLeft: 'corner-bottom-left',
  cornerBottomRight: 'corner-bottom-right',
} as const

/** Суффикс сайдкара кадра. */
export const SIDECAR_SUFFIX = '.meta.json'

/**
 * Опции встроенного упаковщика: без поворотов кадров, обрезки полей и уменьшенных копий. Обрезку делает `sharp.trim`
 * с медианным фильтром: он стирает линии толщиной в пиксель и обрезает по ним кадр.
 */
export const TEXTURE_PACKER_OPTIONS = {
  texturePacker: {
    padding: 2,
    allowRotation: false,
    allowTrim: false,
    nameStyle: 'relative',
    removeFileExtension: false,
    autodetectAnimations: true,
  },
  resolutionOptions: {
    resolutions: { default: 1 },
    fixedResolution: 'default',
  },
} as const
