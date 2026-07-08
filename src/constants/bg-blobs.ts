type BlobConfig = {
  color: number
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
}

export const BG_BLOBS: BlobConfig[] = [
  {
    color: 0x4c1d95,
    alpha: 0.85,
    size: 1.35,
    cx: 0.3,
    cy: 0.3,
    ax: 0.18,
    ay: 0.14,
    sx: 0.071,
    sy: 0.053,
    phaseX: 0,
    phaseY: 1.7,
    pulseSpeed: 0.09,
    phasePulse: 0.4,
  },
  {
    color: 0x7c3aed,
    alpha: 0.7,
    size: 0.95,
    cx: 0.68,
    cy: 0.25,
    ax: 0.2,
    ay: 0.12,
    sx: 0.049,
    sy: 0.083,
    phaseX: 2.1,
    phaseY: 0.6,
    pulseSpeed: 0.11,
    phasePulse: 2.2,
  },
  {
    color: 0xa98fc3,
    alpha: 0.5,
    size: 0.7,
    cx: 0.82,
    cy: 0.62,
    ax: 0.16,
    ay: 0.18,
    sx: 0.061,
    sy: 0.044,
    phaseX: 4.3,
    phaseY: 3.1,
    pulseSpeed: 0.07,
    phasePulse: 1.1,
  },
  {
    color: 0x059669,
    alpha: 0.8,
    size: 1.15,
    cx: 0.25,
    cy: 0.78,
    ax: 0.22,
    ay: 0.13,
    sx: 0.055,
    sy: 0.077,
    phaseX: 1.2,
    phaseY: 5,
    pulseSpeed: 0.1,
    phasePulse: 3.5,
  },
  {
    color: 0x6ec3a7,
    alpha: 0.55,
    size: 0.75,
    cx: 0.58,
    cy: 0.72,
    ax: 0.24,
    ay: 0.2,
    sx: 0.089,
    sy: 0.067,
    phaseX: 3.4,
    phaseY: 2.4,
    pulseSpeed: 0.13,
    phasePulse: 5.2,
  },
]
