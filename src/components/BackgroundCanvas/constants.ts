import { PALETTE } from 'src/core/palette'

type BlobConfig = {
  /** CSS-цвет тинта спрайта */
  color: string
  alpha: number
  /** Диаметр относительно большей стороны экрана: > 1 — блоб крупнее экрана, краёв не видно */
  size: number
  /** Центр дрейфа в долях экрана */
  cx: number
  cy: number
  /** Амплитуда дрейфа в долях экрана */
  ax: number
  ay: number
  /** Скорость дрейфа, рад/сек */
  sx: number
  sy: number
  /** Фазы, чтобы блобы не ходили синхронно */
  phaseX: number
  phaseY: number
  /** Медленная пульсация масштаба */
  pulseSpeed: number
  phasePulse: number
  /** Задержка появления от старта сцены, сек: блобы проявляются каскадом, а не все разом */
  spawnDelay: number
}

/** Сколько длится появление одного блоба (0 → полный размер и альфа), сек */
export const BG_SPAWN_DURATION = 1.2

/** Фон канваса под блобами; его же берёт экран загрузки игры */
export const BG_CANVAS_COLOR = '#1e293b'

export const BG_BLOBS: BlobConfig[] = [
  {
    color: '#4c1d95',
    alpha: 0.85,
    size: 1.35,
    cx: 0.3,
    cy: 0.3,
    ax: 0.32,
    ay: 0.3,
    sx: 0.284,
    sy: 0.212,
    phaseX: 0,
    phaseY: 1.7,
    pulseSpeed: 0.31,
    phasePulse: 0.4,
    spawnDelay: 0,
  },
  {
    color: '#7c3aed',
    alpha: 0.7,
    size: 0.95,
    cx: 0.68,
    cy: 0.25,
    ax: 0.36,
    ay: 0.28,
    sx: 0.196,
    sy: 0.332,
    phaseX: 2.1,
    phaseY: 0.6,
    pulseSpeed: 0.37,
    phasePulse: 2.2,
    spawnDelay: 0.15,
  },
  {
    color: PALETTE.primary,
    alpha: 0.5,
    size: 0.7,
    cx: 0.82,
    cy: 0.62,
    ax: 0.34,
    ay: 0.38,
    sx: 0.244,
    sy: 0.176,
    phaseX: 4.3,
    phaseY: 3.1,
    pulseSpeed: 0.28,
    phasePulse: 1.1,
    spawnDelay: 0.3,
  },
  {
    color: '#059669',
    alpha: 0.8,
    size: 1.15,
    cx: 0.25,
    cy: 0.78,
    ax: 0.38,
    ay: 0.3,
    sx: 0.22,
    sy: 0.308,
    phaseX: 1.2,
    phaseY: 5,
    pulseSpeed: 0.34,
    phasePulse: 3.5,
    spawnDelay: 0.45,
  },
  {
    color: PALETTE.accent,
    alpha: 0.55,
    size: 0.75,
    cx: 0.58,
    cy: 0.72,
    ax: 0.4,
    ay: 0.36,
    sx: 0.356,
    sy: 0.268,
    phaseX: 3.4,
    phaseY: 2.4,
    pulseSpeed: 0.4,
    phasePulse: 5.2,
    spawnDelay: 0.6,
  },
]
