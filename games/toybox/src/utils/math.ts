/** Зажимает значение в отрезок. */
export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/** Линейная интерполяция: доля `progress` пути от `from` к `to`. */
export const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress
