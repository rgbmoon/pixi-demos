// Количество барабанов и видимых символов фиксировано: reel-frame не позволяет разместить больше
/** Барабанов в машине. */
export const REELS_COUNT = 5
/** Видимых символов в барабане. */
export const VISIBLE_SYMBOLS_COUNT = 3
/** Ячейка сверх видимых: держит символ, въезжающий в зону сверху. */
export const BUFFER_SYMBOLS_COUNT = 1
/** Лесенка остановки: на столько ячеек каждый следующий барабан крутится дольше предыдущего. */
export const LAND_STAGGER_CELLS = 2

// Скорости и ускорение — на кадр приведённой частоты (deltaTime = 1 при 60 fps)
/** Скорость прокрутки ленты, px/кадр. */
export const SPIN_SPEED = 60
/** На столько падает скорость ленты за кадр торможения, px/кадр². */
export const LANDING_DECELERATION = 2
/** Скорость, до которой линейное торможение доводит ленту перед отскоком, px/кадр. */
export const LANDING_HANDOVER_SPEED = 30
/** Длительность торможения в кадрах: за неё скорость падает с `SPIN_SPEED` до `LANDING_HANDOVER_SPEED`. */
export const LANDING_BRAKE_FRAMES = (SPIN_SPEED - LANDING_HANDOVER_SPEED) / LANDING_DECELERATION
/** Путь торможения: интеграл скорости по `LANDING_BRAKE_FRAMES`. */
export const LANDING_BRAKE_DISTANCE = (SPIN_SPEED ** 2 - LANDING_HANDOVER_SPEED ** 2) / (2 * LANDING_DECELERATION)
/** Хвост посадки, который лента проходит отскоком, в долях ячейки. */
export const LANDING_EASE_CELLS = 0.25
/** Сила отскока в терминах `easeOutBack`: заброс за точку посадки растёт быстрее этого числа, см. её JSDoc. */
export const LANDING_BACK_STRENGTH = 0.35

// Зона символов внутри рамки: пять шагов между divider_center и высота разделителя, обе величины из frame.json
/** Ширина зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_WIDTH = 1006.7
/** Высота зоны символов в нативных пикселях рамки. */
export const REELS_ZONE_HEIGHT = 589
/** Масштаб машины: задаётся один раз, на ресайз экрана машина не реагирует (пока что). */
export const REELS_MACHINE_SCALE = 0.4
/** Коэффициент отката канонической easeOutBack (значение с easings.net). */
export const REFERENCE_BACK_FACTOR = 1.70158
/** Заброс канонической кривой: её пик превышает цель на 9.99% дистанции. Служит нормировкой для `backStrength`. */
export const REFERENCE_OVERSHOOT = 0.0999
