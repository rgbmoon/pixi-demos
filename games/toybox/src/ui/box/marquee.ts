import { BitmapText, Container, type DestroyOptions, Graphics, Matrix, type Ticker } from 'pixi.js'

import { CABINET_FRAMES, FONT_FAMILIES } from '#src/assets'
import {
  LAMP_FLICKER_SEED,
  LAMP_PRIZE_COLOR,
  MARQUEE_SCREEN_FRAME,
  MARQUEE_SCROLL_STEP_MS,
  MARQUEE_TEXT_INSET,
  MARQUEE_TEXT_ROWS,
  PIXEL_FONT_SIZE,
} from '#src/constants'
import { Face } from '#src/ui/box/face'
import { getCabinetFaces, getMarqueeLampCenters } from '#src/utils/machine-geometry'
import { getFaceMatrix, getFaceSize, worldToScreen } from '#src/utils/projection'
import { createRandom } from '@pixi-demos/core/random'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Lamp } from './lamp'

/**
 * Крыша автомата с экраном для вывода текста и символов и рядом ламп. Текст стоит у левого края экрана, текст шире
 * экрана идёт бегущей строкой справа налево.
 */
export class Marquee extends Container {
  private readonly ticker: GameTicker
  private readonly message: BitmapText
  private readonly screenWidth: number
  private readonly lamps: Lamp[]
  /** Время, накопленное до следующего шага бегущей строки. */
  private pendingMs = 0

  constructor(ticker: GameTicker) {
    super()

    this.ticker = ticker

    const faces = getCabinetFaces()

    // Текст лежит в плоскости экрана табло: координаты — пиксели кадра экрана, наклон задаёт матрица грани
    const screenSize = getFaceSize(faces.marqueeScreen)
    const { a, b, c, d, tx, ty } = getFaceMatrix(faces.marqueeScreen, screenSize)
    const screen = new Container()

    this.screenWidth = screenSize.width
    this.message = new BitmapText({
      text: '',
      style: { fontFamily: FONT_FAMILIES.marquee, fontSize: PIXEL_FONT_SIZE },
    })
    screen.setFromMatrix(new Matrix(a, b, c, d, tx, ty))

    // Бегущая строка видна только внутри рамы экрана
    const textArea = new Graphics()
      .rect(MARQUEE_SCREEN_FRAME, MARQUEE_SCREEN_FRAME, this.screenWidth - 2 * MARQUEE_SCREEN_FRAME, MARQUEE_TEXT_ROWS)
      .fill(0xffffff)

    this.message.mask = textArea
    screen.addChild(textArea, this.message)

    // Мерцание ламп берёт свой генератор: оно не тратит `Math.random` игры
    const random = createRandom(LAMP_FLICKER_SEED)

    this.lamps = getMarqueeLampCenters().map((center) => {
      const lamp = new Lamp(ticker, random)

      lamp.position.copyFrom(worldToScreen(center))

      return lamp
    })

    this.addChild(
      new Face(CABINET_FRAMES.marqueeRoof, faces.marqueeRoof),
      new Face(CABINET_FRAMES.marqueeSide, faces.marqueeSide),
      new Face(CABINET_FRAMES.marqueeFront, faces.marqueeFront),
      new Face(CABINET_FRAMES.marqueeScreen, faces.marqueeScreen),
      ...this.lamps,
      screen
    )
  }

  /** Зажигает `count` ламп выигранных игрушек слева направо и гасит остальные. */
  setLitLamps(count: number): void {
    this.lamps.forEach((lamp, index) => {
      if (index < count) lamp.turnOn(LAMP_PRIZE_COLOR)
      else lamp.turnOff()
    })
  }

  override destroy(options?: DestroyOptions): void {
    this.ticker.remove(this.scroll)
    super.destroy(options)
  }

  /** Выводит текст: умещающийся — у левого края экрана табло, более широкий — бегущей строкой. */
  setMessage(message: string): void {
    this.message.text = message
    this.ticker.remove(this.scroll)

    // Ширина — без маски: границы с маской включают её прямоугольник
    const { width } = this.message
    const inset = MARQUEE_SCREEN_FRAME + MARQUEE_TEXT_INSET

    if (width <= this.screenWidth - 2 * inset) {
      this.message.position.set(inset, inset)

      return
    }

    this.message.position.set(this.screenWidth - MARQUEE_SCREEN_FRAME, inset)
    this.pendingMs = 0
    this.ticker.add(this.scroll)
  }

  /** Сдвигает бегущую строку на пиксель арта за шаг; ушедшая за левый край строка снова входит справа. */
  private scroll = (ticker: Ticker): void => {
    this.pendingMs += ticker.deltaMS

    const steps = Math.floor(this.pendingMs / MARQUEE_SCROLL_STEP_MS)

    if (steps === 0) return

    this.pendingMs -= steps * MARQUEE_SCROLL_STEP_MS
    this.message.x -= steps

    if (this.message.x + this.message.width < MARQUEE_SCREEN_FRAME) {
      this.message.x = this.screenWidth - MARQUEE_SCREEN_FRAME
    }
  }
}
