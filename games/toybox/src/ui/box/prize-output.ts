import { Container } from 'pixi.js'

import { HATCH_FRAMES } from '#src/assets'
import { TOY_SPEECH_TIP } from '#src/constants'
import type { ToyKey } from '#src/types'
import { getPrizeHatchFaces } from '#src/utils/machine-geometry'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'

import { Face } from './face'
import { PrizeDoor } from './prize-door'
import { PrizeNiche } from './prize-niche'
import { ToySpeech } from './toy-speech'

/** Окно выдачи на передней грани тумбы: ниша с призом, шторка, металлический обод и облако реплики приза. */
export class PrizeOutput extends Container {
  private readonly niche: PrizeNiche
  private readonly door: PrizeDoor
  private readonly speech: ToySpeech

  constructor(ticker: GameTicker) {
    super()

    this.niche = new PrizeNiche(ticker)
    this.door = new PrizeDoor(ticker)
    this.speech = new ToySpeech(ticker)
    this.speech.position.copyFrom(snapToArtPixel(worldToScreen(TOY_SPEECH_TIP)))

    this.addChild(this.niche, this.door, new Face(HATCH_FRAMES.rim, getPrizeHatchFaces().rim), this.speech)
  }

  /** Ставит выигранную игрушку в тёмную нишу за закрытой шторкой. */
  show(toy: ToyKey): void {
    this.niche.setPrize(toy)
    this.niche.turnOff()
    this.door.shut()
  }

  /** Поднимает шторку, затем зажигает свет в нише; промис резолвится, когда свет загорелся. */
  async open(signal: AbortSignal): Promise<void> {
    await this.door.open(signal)
    await this.niche.turnOn(signal)
  }

  /** Выводит реплику приза в облаке над окном; промис резолвится, когда выведен последний символ. */
  speak(speech: string, signal: AbortSignal): Promise<void> {
    return this.speech.say(speech, signal)
  }

  /** Убирает игрушку из ниши вместе с её репликой: шторка остаётся открытой, свет горит. */
  eject(): void {
    this.niche.hidePrize()
    this.speech.hush()
  }

  /** Опускает шторку; промис резолвится, когда окно закрыто. */
  close(signal: AbortSignal): Promise<void> {
    return this.door.close(signal)
  }

  /** Прячет игрушку и реплику, гасит свет и закрывает шторку. */
  hide(): void {
    this.niche.hidePrize()
    this.speech.hush()
    this.niche.turnOff()
    this.door.shut()
  }
}
