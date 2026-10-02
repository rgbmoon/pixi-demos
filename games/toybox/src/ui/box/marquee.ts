import { Container, Matrix, Text } from 'pixi.js'

import { CABINET_FRAMES } from '#src/assets'
import {
  CABINET_FRONT_PLANE,
  CELL_SIZE,
  HUD_FONT_FAMILY,
  LAMP_FLICKER_SEED,
  LAMP_PRIZE_COLOR,
  MARQUEE_TEXT_CENTER,
} from '#src/constants'
import { Face } from '#src/ui/box/face'
import { getCabinetFaces, getMarqueeLampCenters } from '#src/utils/machine-geometry'
import { projectPlaneOffset, worldToScreen } from '#src/utils/projection'
import { PALETTE } from '@pixi-demos/core/palette'
import { createRandom } from '@pixi-demos/core/random'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Lamp } from './lamp'

/**
 * Крыша автомата с экраном для вывода текста и символов и рядом ламп
 * TODO сделать вывод текста бегущей строкой
 */
export class Marquee extends Container {
  private readonly message: Text
  private readonly lamps: Lamp[]

  constructor(ticker: GameTicker) {
    super()

    const faces = getCabinetFaces()

    this.message = new Text({
      text: 'WELCOME',
      style: {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: 32,
        fontWeight: 'bold',
        fill: PALETTE.white,
        align: 'center',
      },
      anchor: 0.5,
    })

    const horizontal = projectPlaneOffset(CABINET_FRONT_PLANE, CELL_SIZE, 0)
    const vertical = projectPlaneOffset(CABINET_FRONT_PLANE, 0, CELL_SIZE)
    const center = worldToScreen(MARQUEE_TEXT_CENTER)

    this.message.setFromMatrix(
      new Matrix(
        horizontal.x / CELL_SIZE,
        horizontal.y / CELL_SIZE,
        vertical.x / CELL_SIZE,
        vertical.y / CELL_SIZE,
        center.x,
        center.y
      )
    )

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
      this.message
    )
  }

  /** Зажигает `count` ламп выигранных игрушек слева направо и гасит остальные. */
  setLitLamps(count: number): void {
    this.lamps.forEach((lamp, index) => {
      if (index < count) lamp.turnOn(LAMP_PRIZE_COLOR)
      else lamp.turnOff()
    })
  }

  /** Выводит текст на переднюю грань табло. */
  setMessage(message: string): void {
    this.message.text = message
  }
}
