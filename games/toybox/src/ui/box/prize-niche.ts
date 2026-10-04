import { Assets, type Texture } from 'pixi.js'

import { HATCH_FRAMES } from '#src/assets'
import {
  PRIZE_LIGHT_FLICKER,
  PRIZE_LIGHT_FLICKER_CHANCE,
  PRIZE_LIGHT_IGNITION,
  PRIZE_LIGHT_SWITCH,
  PRIZE_LIGHT_TINT,
} from '#src/constants'
import { TOY_KEYS } from '#src/toys'
import { Light, type ToyKey } from '#src/types'
import { Face } from '#src/ui/box/face'
import { toLightSequence } from '#src/utils/light'
import { getPrizeHatchFaces } from '#src/utils/machine-geometry'
import { getPrizeSeat } from '#src/utils/shapes'
import { FrameAnimation } from '@pixi-demos/engine/frame-animation'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import type { FrameSequence } from '@pixi-demos/engine/types'

import { Toy } from './toy'

/** Ниша за окном выдачи с призом на полу: свет загорается ровно или с перебоями и мерцает, в темноте приз затемнён. */
export class PrizeNiche extends FrameAnimation<Face> {
  private readonly prize: Toy
  /** Тинт приза по кадру света. */
  private readonly tints: ReadonlyMap<Texture, number>
  private readonly darkness: FrameSequence
  private readonly switching: FrameSequence
  private readonly ignition: FrameSequence
  private readonly flicker: FrameSequence
  private isLit = false

  constructor(ticker: GameTicker) {
    const { off, dim, on } = HATCH_FRAMES.niche
    const lights = { off: Assets.get<Texture>(off), dim: Assets.get<Texture>(dim), on: Assets.get<Texture>(on) }

    super(ticker, new Face(lights.off, getPrizeHatchFaces().opening))

    // До первого приза ниша держит любую игрушку скрытой
    this.prize = new Toy(ticker, TOY_KEYS[0])
    this.prize.visible = false
    this.tints = new Map(Object.values(Light).map((light) => [lights[light], PRIZE_LIGHT_TINT[light]]))
    this.darkness = toLightSequence(lights, [[Light.off, 0]])
    this.switching = toLightSequence(lights, PRIZE_LIGHT_SWITCH)
    this.ignition = toLightSequence(lights, PRIZE_LIGHT_IGNITION)
    this.flicker = toLightSequence(lights, PRIZE_LIGHT_FLICKER)
    this.addChild(this.prize)
  }

  /** Ставит игрушку на пол ниши. */
  setPrize(toy: ToyKey): void {
    this.prize.setAppearance(toy)
    this.prize.setPose(getPrizeSeat(toy), 0)
    this.prize.visible = true
  }

  /** Убирает игрушку из ниши. */
  hidePrize(): void {
    this.prize.visible = false
  }

  /** Зажигает свет; промис резолвится, когда свет загорелся. Свет с перебоями дальше мерцает. */
  async turnOn(signal: AbortSignal): Promise<void> {
    // Перебои — косметика: бросок не влияет на исход раунда
    const isFaulty = Math.random() < PRIZE_LIGHT_FLICKER_CHANCE

    this.isLit = true
    await this.playOnce(isFaulty ? this.ignition : this.switching, signal)
    // Свет, погашенный во время розжига, не мерцает
    if (isFaulty && this.isLit) this.play(this.flicker)
  }

  /** Гасит свет. */
  turnOff(): void {
    this.isLit = false
    this.showFrame(this.darkness, 0)
  }

  protected override applyFrame(texture: Texture | undefined): void {
    super.applyFrame(texture)

    const tint = texture && this.tints.get(texture)

    if (tint !== undefined && !this.destroyed) this.prize.tint = tint
  }
}
