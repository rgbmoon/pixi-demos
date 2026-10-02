import { Container } from 'pixi.js'

import { HATCH_FRAMES } from '#src/assets'
import type { ToyAppearance } from '#src/types'
import { getPrizeHatchFaces } from '#src/utils/machine-geometry'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Face } from './face'
import { PrizeDoor } from './prize-door'
import { PrizeNiche } from './prize-niche'

/** Окно выдачи на передней грани тумбы: ниша с призом, шторка и металлический обод. */
export class PrizeOutput extends Container {
  private readonly niche: PrizeNiche
  private readonly door: PrizeDoor

  constructor(ticker: GameTicker) {
    super()

    this.niche = new PrizeNiche(ticker)
    this.door = new PrizeDoor(ticker)

    this.addChild(this.niche, this.door, new Face(HATCH_FRAMES.rim, getPrizeHatchFaces().rim))
  }

  /** Ставит выигранную игрушку в тёмную нишу за закрытой шторкой. */
  show(appearance: ToyAppearance): void {
    this.niche.setPrize(appearance)
    this.niche.turnOff()
    this.door.shut()
  }

  /** Поднимает шторку, затем зажигает свет в нише; промис резолвится, когда свет загорелся. */
  async open(signal: AbortSignal): Promise<void> {
    await this.door.open(signal)
    await this.niche.turnOn(signal)
  }

  /** Убирает игрушку из ниши: шторка остаётся открытой, свет горит. */
  eject(): void {
    this.niche.hidePrize()
  }

  /** Опускает шторку; промис резолвится, когда окно закрыто. */
  close(signal: AbortSignal): Promise<void> {
    return this.door.close(signal)
  }

  /** Прячет игрушку, гасит свет и закрывает шторку. */
  hide(): void {
    this.niche.hidePrize()
    this.niche.turnOff()
    this.door.shut()
  }
}
