import { Assets, Container, NineSliceSprite, Sprite, type Texture } from 'pixi.js'

import { HUD_FRAMES } from '#src/assets'
import {
  ART_PIXEL,
  BUBBLE_GROW_STEP_MS,
  BUBBLE_GROW_STEPS,
  BUBBLE_MIN_SIZE,
  BUBBLE_PADDING,
  BUBBLE_TAIL_INSET,
} from '#src/constants'
import type { BubbleTail } from '#src/types'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

/**
 * Облако диалога: светлая подложка 9-slice, хвост и содержимое. Начало координат — острие хвоста, единица — пиксель
 * арта. Облако появляется ростом от хвоста целыми шагами.
 */
export class Bubble extends Container {
  /** Содержимое облака: его левый верхний угол лежит на поле от края подложки. */
  readonly content = new Container()

  private readonly ticker: GameTicker
  private readonly tail: BubbleTail
  private readonly panel: NineSliceSprite
  private readonly tailSprite: Sprite

  constructor(ticker: GameTicker, tail: BubbleTail) {
    super()

    this.ticker = ticker
    this.tail = tail
    this.panel = new NineSliceSprite({ texture: Assets.get<Texture>(HUD_FRAMES.bubble) })
    this.tailSprite = new Sprite(Assets.get<Texture>(HUD_FRAMES.bubbleTail))

    // Кадр хвоста смотрит остриём вниз-влево, другие стороны — его отражения; пиксель острия встаёт в начало координат
    const size = this.tailSprite.texture.height

    this.tailSprite.scale.set(tail.right ? -1 : 1, tail.up ? -1 : 1)
    this.tailSprite.position.set(tail.right ? 1 : 0, tail.up ? size : 1 - size)

    this.scale.set(ART_PIXEL)
    this.visible = false
    this.addChild(this.panel, this.tailSprite, this.content)
  }

  /** Раскрывает облако под содержимое `width` × `height` px арта; промис резолвится, когда облако полного размера. */
  async open(width: number, height: number, signal: AbortSignal): Promise<void> {
    const fullWidth = width + 2 * BUBBLE_PADDING
    const fullHeight = height + 2 * BUBBLE_PADDING

    this.content.visible = false
    this.visible = true

    if (!isReducedMotion()) {
      for (let step = 1; step < BUBBLE_GROW_STEPS; step++) {
        const share = step / BUBBLE_GROW_STEPS

        this.resize(
          Math.round(BUBBLE_MIN_SIZE + (fullWidth - BUBBLE_MIN_SIZE) * share),
          Math.round(BUBBLE_MIN_SIZE + (fullHeight - BUBBLE_MIN_SIZE) * share)
        )
        await this.ticker.waitTicks(BUBBLE_GROW_STEP_MS, signal)
      }
    }

    this.resize(fullWidth, fullHeight)
    this.content.visible = true
  }

  /** Прячет облако. */
  close(): void {
    this.visible = false
  }

  /** Ставит подложку размером `width` × `height` px арта так, что хвост остаётся на месте. */
  private resize(width: number, height: number): void {
    const size = this.tailSprite.texture.height
    // Основание хвоста перекрывает крайнюю строку подложки, хвост отступает от её бокового края
    const x = this.tail.right ? 1 + BUBBLE_TAIL_INSET - width : -BUBBLE_TAIL_INSET
    const y = this.tail.up ? size - 1 : 2 - size - height

    this.panel.setSize(width, height)
    this.panel.position.set(x, y)
    this.content.position.set(x + BUBBLE_PADDING, y + BUBBLE_PADDING)
  }
}
