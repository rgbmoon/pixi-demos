import type { Sprite } from 'pixi.js'

import type { StubKey, StubProperty, StubSlotData } from './types'

/**
 * Значение дорожки в момент `time`: линейно между соседними ключами, за краями — крайний ключ.
 * Ступенчатая выборка (`stepped`) держит значение до следующего ключа — так ведут себя флаги.
 */
export const sampleKeys = (keys: readonly StubKey[], time: number, stepped = false): number => {
  const first = keys[0]

  if (time <= first.time) return first.value

  for (let index = 1; index < keys.length; index++) {
    const key = keys[index]

    if (time > key.time) continue

    const previous = keys[index - 1]

    if (stepped) return previous.value

    const span = key.time - previous.time
    const progress = span > 0 ? (time - previous.time) / span : 1

    return previous.value + (key.value - previous.value) * progress
  }

  return keys[keys.length - 1].value
}

/** Пишет значение дорожки в спрайт слота. */
export const applyProperty = (sprite: Sprite, property: StubProperty, value: number): void => {
  switch (property) {
    case 'x':
      sprite.x = value
      break
    case 'y':
      sprite.y = value
      break
    case 'scale':
      sprite.scale.set(value)
      break
    case 'alpha':
      sprite.alpha = value
      break
    case 'rotation':
      sprite.rotation = value
      break
    case 'visible':
      sprite.visible = value >= 1
      break
  }
}

/** Возвращает спрайт слота в setup-позу: анимируемые свойства сбрасываются перед каждым кадром. */
export const applySetupPose = (sprite: Sprite, slot: StubSlotData): void => {
  sprite.position.set(slot.x ?? 0, slot.y ?? 0)
  sprite.rotation = 0
  sprite.visible = slot.visible ?? true
  sprite.alpha = slot.alpha ?? 1
  sprite.scale.set(slot.scale ?? 1)
}
