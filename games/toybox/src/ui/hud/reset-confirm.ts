import { BitmapText, Container } from 'pixi.js'

import { FONT_FAMILIES } from '#src/assets'
import {
  PIXEL_FONT_CAP_HEIGHT,
  PIXEL_FONT_SIZE,
  RESET_CANCEL_ICON,
  RESET_CANCEL_LABEL,
  RESET_CONFIRM_GAP,
  RESET_CONFIRM_ICON,
  RESET_CONFIRM_LABEL,
  RESET_CONFIRM_TEXT,
} from '#src/constants'
import type { FrameSize, ResetConfirmOptions } from '#src/types'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Bubble } from './bubble'
import { IconButton } from './icon-button'

/** Диалог подтверждения сброса: облако с хвостом к кнопке сброса, вопрос и кнопки-иконки подтверждения и отмены. */
export class ResetConfirm extends Container {
  readonly confirm: IconButton
  readonly cancel: IconButton

  private readonly bubble: Bubble
  private readonly size: FrameSize

  constructor(ticker: GameTicker, options: ResetConfirmOptions) {
    super()

    const question = new BitmapText({
      text: RESET_CONFIRM_TEXT,
      style: { fontFamily: FONT_FAMILIES.dialog, fontSize: PIXEL_FONT_SIZE },
    })

    this.bubble = new Bubble(ticker, { up: true, right: true })
    // Области нажатия соседних кнопок сходятся посередине промежутка
    const hitPadding = RESET_CONFIRM_GAP / 2

    this.confirm = new IconButton(
      { label: RESET_CONFIRM_LABEL, onTap: options.onConfirm },
      RESET_CONFIRM_ICON,
      hitPadding
    )
    this.cancel = new IconButton({ label: RESET_CANCEL_LABEL, onTap: options.onCancel }, RESET_CANCEL_ICON, hitPadding)

    // Вопрос и кнопки стоят в одну строку
    let x = 0

    for (const item of [question, this.confirm, this.cancel]) {
      item.x = x
      x += item.getLocalBounds().width + RESET_CONFIRM_GAP
    }

    this.size = { width: x - RESET_CONFIRM_GAP, height: PIXEL_FONT_CAP_HEIGHT }
    this.bubble.content.addChild(question, this.confirm, this.cancel)
    this.addChild(this.bubble)
  }

  /** Раскрывает облако; кнопки доступны, когда облако полного размера. */
  open(signal: AbortSignal): Promise<void> {
    return this.bubble.open(this.size.width, this.size.height, signal)
  }

  /** Прячет облако и отпускает кнопки. */
  close(): void {
    this.bubble.close()
    this.confirm.setPressed(false)
    this.cancel.setPressed(false)
  }
}
