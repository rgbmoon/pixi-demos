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
