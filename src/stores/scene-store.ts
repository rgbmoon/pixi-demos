import { inject, injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import type { GameInitResponse, RootApi, SpinResponse } from 'src/api/root-api'
import { TOKENS } from 'src/constants/tokens'
import { PhaseName, type SymbolKey } from 'src/types/game'

import type { FlowStore } from './flow-store'
import { AsyncValue } from './utils/async-value'

@injectable()
export class SceneStore {
  private readonly flowStore: FlowStore

  /** Завершение initGame: GameRoot ждёт его перед стартом автомата, исход запроса — в `game.status`. */
  readonly gameLoaded: Promise<void>

  constructor(@inject(TOKENS.RootApi) api: RootApi, @inject(TOKENS.FlowStore) flowStore: FlowStore) {
    makeObservable(this)

    this.flowStore = flowStore

    this.gameLoaded = this.game.run(api.initGame())
  }

  @observable isSoundOn = true
  @observable isAutospin = false
  @observable bet = 10
  @observable gameMode = 4
  // TODO прописать базовую логику баланса - списывать деньги, начислять выигрыш, настраивать размер ставки
  @observable credit = 999999
  @observable win = 0

  @observable.ref game = new AsyncValue<GameInitResponse>()
  @observable.ref spin = new AsyncValue<SpinResponse>()

  @computed get canSpin(): boolean {
    return this.flowStore.phase === PhaseName.idle
  }

  @computed get initialSymbols(): SymbolKey[][] | undefined {
    return this.game.value?.response.result.round.SpinResponse.transformations.find(
      (transformation) => transformation.type === 'frameInit'
    )?.value
  }

  // TODO поправить чтобы нельзя было задать отрициательную ставку
  // Принимать ставку из initial запроса.
  @action setBet(bet: number) {
    this.bet = bet
  }

  @action setGameMode(gameMode: number) {
    this.gameMode = gameMode
  }

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }

  @action toggleAutospin() {
    this.isAutospin = !this.isAutospin
  }
}
