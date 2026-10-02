import { BitmapFontManager, BitmapText, Container, TextStyle } from 'pixi.js'

import { FONT_FAMILIES } from '#src/assets'
import {
  BUBBLE_LINE_HEIGHT,
  BUBBLE_TEXT_WIDTH,
  PIXEL_FONT_CAP_HEIGHT,
  PIXEL_FONT_SIZE,
  TOY_SPEECH_CHAR_MS,
} from '#src/constants'
import { Bubble } from '#src/ui/hud/bubble'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

/** Реплика приза в окне выдачи: облако с хвостом к игрушке, текст выводится посимвольно. */
export class ToySpeech extends Container {
  private readonly ticker: GameTicker
  private readonly bubble: Bubble
  private readonly style = new TextStyle({
    fontFamily: FONT_FAMILIES.dialog,
    fontSize: PIXEL_FONT_SIZE,
    lineHeight: BUBBLE_LINE_HEIGHT,
  })
  private readonly wrapStyle: TextStyle
  private readonly text: BitmapText

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker
    this.wrapStyle = this.style.clone()
    this.wrapStyle.wordWrap = true
    this.wrapStyle.wordWrapWidth = BUBBLE_TEXT_WIDTH
    this.bubble = new Bubble(ticker, { up: false, right: false })
    this.text = new BitmapText({ text: '', style: this.style })

    this.bubble.content.addChild(this.text)
    this.addChild(this.bubble)
  }

  /** Раскрывает облако и выводит реплику посимвольно; промис резолвится, когда выведен последний символ. */
  async say(speech: string, signal: AbortSignal): Promise<void> {
    // Переносы ставятся заранее: при выводе по символам слово не перескакивает на следующую строку. Раскладка
    // заканчивается пустой строкой, она отбрасывается
    const rows = BitmapFontManager.getLayout(speech, this.wrapStyle)
      .lines.map(({ chars }) => chars.join('').trim())
      .filter((row) => row.length > 0)
    const wrapped = rows.join('\n')

    this.text.text = wrapped

    // Высота — по заглавным: поля облака над текстом и под ним равны
    const { width } = this.text.getLocalBounds()

    this.text.text = ''
    await this.bubble.open(width, (rows.length - 1) * BUBBLE_LINE_HEIGHT + PIXEL_FONT_CAP_HEIGHT, signal)

    if (isReducedMotion()) {
      this.text.text = wrapped

      return
    }

    for (let count = 1; count <= wrapped.length; count++) {
      this.text.text = wrapped.slice(0, count)
      await this.ticker.waitTicks(TOY_SPEECH_CHAR_MS, signal)
    }
  }

  /** Прячет облако и текст. */
  hush(): void {
    this.bubble.close()
    this.text.text = ''
  }
}
