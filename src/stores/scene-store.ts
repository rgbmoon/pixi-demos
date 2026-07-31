import { inject, injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import type { GameInitResponse, Payline, RootApi, RoundTransformation, SpinResponse } from 'src/api/root-api'
import { DEFAULT_GAME_MODE } from 'src/constants/game'
import { TOKENS } from 'src/constants/tokens'
import { PhaseName, StepDirection, type SymbolKey } from 'src/types/game'

import type { FlowStore } from './flow-store'
import { AsyncValue } from './utils/async-value'

@injectable()
export class SceneStore {
  private readonly flowStore: FlowStore

  readonly gameLoaded: Promise<void>

  constructor(@inject(TOKENS.RootApi) api: RootApi, @inject(TOKENS.FlowStore) flowStore: FlowStore) {
    makeObservable(this)

    this.flowStore = flowStore

    this.gameLoaded = this.loadGame(api)
  }

  @observable isSoundOn = true
  @observable isAutospin = false
  @observable betIndex = 0
  @observable gameMode: string = DEFAULT_GAME_MODE
  @observable credit = 0
  @observable win = 0

  @observable.ref game = new AsyncValue<GameInitResponse>()
  @observable.ref spin = new AsyncValue<SpinResponse>()

  /** Запрашивает данные игры и переносит их в стор; ошибку запроса держит `game.status`. */
  private async loadGame(api: RootApi): Promise<void> {
    await this.game.run(api.initGame())

    this.applyInit()
  }

  private get gameSettings(): GameInitResponse['response']['result']['gameSettings'] | undefined {
    return this.game.value?.response.result.gameSettings
  }

  /** Настройки текущего режима: список ставок и коэффициент. Режим без LuckyBet в списке отсутствует. */
  private get luckyBet() {
    return this.gameSettings?.allowedLuckyBets.find((luckyBet) => luckyBet.gameMode === this.gameMode)
  }

  @computed get gameModes(): GameInitResponse['response']['result']['gameSettings']['availableGameModes'] {
    return this.gameSettings?.availableGameModes ?? []
  }

  /** Число линий, участвующих в раунде: коэффициент режима (Line3 → 3, Line10 → 10). */
  @computed get lines(): number {
    return this.luckyBet?.coefficient ?? 1
  }

  /** Ставки, допустимые в текущем режиме; списки всех режимов одной длины, поэтому индекс переносится. */
  @computed get bets(): number[] {
    return this.luckyBet?.bets ?? this.gameSettings?.allowedBets ?? []
  }

  @computed get bet(): number {
    return this.bets[this.betIndex] ?? 0
  }

  @computed get isIdle(): boolean {
    return this.flowStore.phase === PhaseName.idle
  }

  @computed get canSpin(): boolean {
    return this.isIdle && this.bet > 0 && this.bet <= this.credit
  }

  @computed get initialSymbols(): SymbolKey[][] | undefined {
    return this.game.value?.response.result.round.SpinResponse.transformations.find(
      (transformation) => transformation.type === 'frameInit'
    )?.value
  }

  private get spinTransformations(): RoundTransformation[] {
    return this.spin.value?.response.result.SpinResponse.transformations ?? []
  }

  @computed get spinSymbols(): SymbolKey[][] | undefined {
    return this.spinTransformations.find((transformation) => transformation.type === 'frameInit')?.value
  }

  @computed get spinPaylines(): Payline[] {
    return this.spinTransformations.find((transformation) => transformation.type === 'paylines')?.value ?? []
  }

  @computed get spinWin(): number {
    return this.spinTransformations.find((transformation) => transformation.type === 'win')?.value ?? 0
  }

  /** Доступен ли шаг по списку ставок: вне idle и за краями списка — нет. */
  canStepBet(direction: StepDirection): boolean {
    return this.isIdle && this.isInBounds(this.betIndex + this.toDelta(direction), this.bets.length)
  }

  /** Доступен ли шаг по списку режимов: вне idle и за краями списка — нет. */
  canStepGameMode(direction: StepDirection): boolean {
    return this.isIdle && this.isInBounds(this.gameModeIndex + this.toDelta(direction), this.gameModes.length)
  }

  private get gameModeIndex(): number {
    return Math.max(
      this.gameModes.findIndex((mode) => mode.gameMode === this.gameMode),
      0
    )
  }

  private isInBounds(index: number, length: number): boolean {
    return index >= 0 && index < length
  }

  private toDelta(direction: StepDirection): number {
    return direction === StepDirection.forward ? 1 : -1
  }

  /** Переносит стартовые значения раунда из ответа initGame: баланс и позицию ставки в списке. */
  @action private applyInit() {
    const result = this.game.value?.response.result

    if (!result) return

    this.credit = result.round.balance

    // round.bet — ставка предыдущего раунда: её позицию ищем в списке текущего режима
    const index = this.bets.indexOf(result.round.bet)

    this.betIndex = index >= 0 ? index : result.gameSettings.defaultBetIndex
  }

  @action stepBet(direction: StepDirection) {
    if (!this.canStepBet(direction)) return

    this.betIndex += this.toDelta(direction)
  }

  @action stepGameMode(direction: StepDirection) {
    if (!this.canStepGameMode(direction)) return

    this.gameMode = this.gameModes[this.gameModeIndex + this.toDelta(direction)].gameMode
  }

  /** Списывает ставку в начале раунда; провал запроса возвращает её через `refundBet`. */
  @action chargeBet() {
    this.credit -= this.bet
  }

  @action refundBet() {
    this.credit += this.bet
  }

  /** Закрывает раунд: баланс берётся серверный (выигрыш в него уже включён), выигрыш гасится. */
  @action settleRound(balance: number) {
    this.credit = balance
    this.win = 0
  }

  @action setWin(win: number) {
    this.win = win
  }

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn
  }

  @action toggleAutospin() {
    this.isAutospin = !this.isAutospin
  }
}
