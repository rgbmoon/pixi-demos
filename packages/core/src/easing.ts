/** Коэффициент отката канонической easeOutBack (значение с easings.net). */
const REFERENCE_BACK_FACTOR = 1.70158

/** Заброс канонической кривой: её пик превышает цель на 9.99% дистанции. Служит нормировкой для `backStrength`. */
const REFERENCE_OVERSHOOT = 0.0999

/** Пересчитывает силу отката в коэффициент кривой: `backStrength` = 0.1 воспроизводит каноническую easeOutBack. */
const getBackFactor = (backStrength: number) => (backStrength * REFERENCE_BACK_FACTOR) / REFERENCE_OVERSHOOT

/**
 * Замедление с проскоком: кривая уходит за цель и возвращается к ней. `progress` и результат — доли единицы,
 * на пике результат превышает 1. Заброс равен `(4/27)·f³/(f+1)²` дистанции при коэффициенте `f`,
 * то есть растёт быстрее `backStrength`: 0.1 даёт 10% дистанции, 0.25 — уже 41%.
 */
export const easeOutBack = (progress: number, backStrength = 0.1) => {
  const backFactor = getBackFactor(backStrength)
  const cubicFactor = backFactor + 1
  // Кривая записана от точки прибытия: в конце движения progressFromEnd = 0, и результат равен ровно 1
  const progressFromEnd = progress - 1

  return 1 + cubicFactor * progressFromEnd ** 3 + backFactor * progressFromEnd ** 2
}

/**
 * Начальная скорость easeOutBack в единицах «дистанция за длительность» — производная кривой в `progress` = 0.
 * По ней подбирают длительность, чтобы кривая подхватила предшествующее движение без рывка.
 */
export const getEaseOutBackInitialSpeed = (backStrength = 0.1) => {
  const backFactor = getBackFactor(backStrength)
  const cubicFactor = backFactor + 1

  // Производная 3·cubicFactor·p² + 2·backFactor·p в точке progressFromEnd = -1
  return 3 * cubicFactor - 2 * backFactor
}

/**
 * Разгон из покоя: скорость нарастает линейно, путь — квадратично. Так падает предмет под тяжестью.
 * `progress` и результат — доли единицы.
 */
export const easeInQuad = (progress: number) => progress * progress

/**
 * Трапецеидальный профиль хода: скорость линейно набирается на первой доле `rampShare` пути,
 * держится постоянной и так же линейно гаснет в конце. Так движется привод с ограниченным
 * ускорением — в отличие от плавных кривых, разброс скорости здесь невелик:
 * её пик равен `1 / (1 - rampShare)` от средней. `progress` и результат — доли единицы.
 */
export const easeTrapezoid = (progress: number, rampShare = 0.2) => {
  const ramp = Math.min(Math.max(rampShare, 0), 0.5)

  if (ramp === 0) return progress

  const peakSpeed = 1 / (1 - ramp)

  if (progress < ramp) return (peakSpeed * progress ** 2) / (2 * ramp)

  if (progress > 1 - ramp) return 1 - (peakSpeed * (1 - progress) ** 2) / (2 * ramp)

  return peakSpeed * (progress - ramp / 2)
}

/**
 * Обращение `easeTrapezoid`: по пройденной доле пути отдаёт долю длительности, за которую привод
 * её проходит. По нему отмеряют момент внутри хода, не прерывая его.
 */
export const easeTrapezoidInverse = (distance: number, rampShare = 0.2) => {
  const ramp = Math.min(Math.max(rampShare, 0), 0.5)
  const covered = Math.min(Math.max(distance, 0), 1)

  if (ramp === 0) return covered

  // Доли пути, пройденные к концу разгона и к началу торможения
  const ramped = ramp / (2 * (1 - ramp))

  if (covered < ramped) return Math.sqrt(2 * ramp * covered * (1 - ramp))

  if (covered > 1 - ramped) return 1 - Math.sqrt(2 * ramp * (1 - covered) * (1 - ramp))

  return covered * (1 - ramp) + ramp / 2
}
