import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import { readStoredFlag, writeStoredFlag } from 'src/core/storage'
import type { GameInitResult, Payline, RoundTransformation, SpinResult } from 'src/games/slot/api/slot'
import { DEFAULT_GAME_MODE, INITIAL_PHASE, SOUND_STORAGE_KEY } from 'src/games/slot/constants'
import { PhaseName, StepDirection, type SymbolKey } from 'src/games/slot/types'

@injectable()
export class SlotStore {
  constructor() {
    makeObservable(this)
  }

  /** Активная фаза раунда. Единственный писатель — движок автомата через `setPhase`. */
  @observable phase: PhaseName = INITIAL_PHASE

  /** Настройка игрока: звук включён. Переживает перезагрузку через localStorage. */
  @observable isSoundOn = readStoredFlag(SOUND_STORAGE_KEY, true)
  /** Настройка игрока: турбо-режим — быстрые спины по тапу и серия по удержанию спина. */
  @observable isTurboEnabled = false
  /** Ввод игрока: кнопка спина зажата дольше порога удержания. Пишет кнопка, отпускание принимается в любой фазе. */
  @observable isSpinHeld = false
  /** Идёт турбо-серия: выигрыши копятся в `win` и уходят в кредит по её закрытию. Пишет автомат. */
  @observable isTurboSeries = false
  @observable isSettingsOpen = false
  @observable betIndex = 0
  @observable gameMode: string = DEFAULT_GAME_MODE
  @observable credit = 0
  @observable win = 0

  // Ответы сервера как есть: их кладут фазы, стор ничего не пересчитывает
  @observable.ref init: GameInitResult | null = null
  @observable.ref spinResult: SpinResult | null = null

  private get gameSettings(): GameInitResult['gameSettings'] | undefined {
    return this.init?.gameSettings
  }

  /** Настройки текущего режима: список ставок и коэффициент. Режим без LuckyBet в списке отсутствует. */
  private get luckyBet() {
    return this.gameSettings?.allowedLuckyBets.find((luckyBet) => luckyBet.gameMode === this.gameMode)
  }

  @computed get gameModes(): GameInitResult['gameSettings']['availableGameModes'] {
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
    return this.phase === PhaseName.idle
  }

  /** Барабаны в движении: фаза `spinning` длится от старта прокрутки до посадки. */
  @computed get isSpinning(): boolean {
    return this.phase === PhaseName.spinning
  }

  /** Хватает ли кредита на ставку. */
  @computed get canAffordBet(): boolean {
    return this.bet > 0 && this.bet <= this.credit
  }

  // При открытой модалке спин недоступен: затемнение перехватывает только события указателя,
  // DOM-кнопки слоя доступности PIXI остаются в табуляции, поэтому прописываем флаг явно
  @computed get canSpin(): boolean {
    return this.isIdle && !this.isSettingsOpen && this.canAffordBet
  }

  /** Можно ли зажать спин под турбо-серию: только в турбо-режиме и когда спин доступен. */
  @computed get canHoldSpin(): boolean {
    return this.canSpin && this.isTurboEnabled
  }

  /** Доступна ли остановка барабанов: в обычном режиме, пока они в движении и модалка закрыта. */
  @computed get canStop(): boolean {
    return this.isSpinning && !this.isTurboEnabled && !this.isSettingsOpen
  }

  @computed get canToggleTurbo(): boolean {
    return this.isIdle
  }

  /** Настройки открываются только в idle: посреди раунда их контролы всё равно недоступны. */
  @computed get canOpenSettings(): boolean {
    return this.isIdle && !this.isSettingsOpen
  }

  @computed get initialSymbols(): SymbolKey[][] | undefined {
    return this.init?.round.SpinResponse.transformations.find((transformation) => transformation.type === 'frameInit')
      ?.value
  }

  private get spinTransformations(): RoundTransformation[] {
    return this.spinResult?.SpinResponse.transformations ?? []
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

  /** Доступен ли шаг по списку ставок: вне idle, при открытой модалке и за краями списка — нет. */
  canStepBet(direction: StepDirection): boolean {
    return (
      this.isIdle && !this.isSettingsOpen && this.isInBounds(this.betIndex + this.toDelta(direction), this.bets.length)
    )
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

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  /** Принимает ответ initGame: настройки раунда, баланс и позицию ставки в списке. */
  @action applyInit(result: GameInitResult) {
    this.init = result
    this.credit = result.round.balance

    // round.bet — ставка предыдущего раунда: её позицию ищем в списке текущего режима
    const index = this.bets.indexOf(result.round.bet)

    this.betIndex = index >= 0 ? index : result.gameSettings.defaultBetIndex
  }

  @action applySpin(result: SpinResult) {
    this.spinResult = result
  }

  /** Гасит результат прошлого раунда перед новым запросом, чтобы вью не показывал устаревшие данные. */
  @action clearSpin() {
    this.spinResult = null
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

  /** Добавляет выигрыш спина к сумме турбо-серии. */
  @action accrueWin(win: number) {
    this.win += win
  }

  @action startSeries() {
    this.isTurboSeries = true
  }

  @action endSeries() {
    this.isTurboSeries = false
  }

  @action toggleSound() {
    this.isSoundOn = !this.isSoundOn

    writeStoredFlag(SOUND_STORAGE_KEY, this.isSoundOn)
  }

  @action toggleTurboEnabled() {
    if (!this.canToggleTurbo) return

    this.isTurboEnabled = !this.isTurboEnabled
  }

  @action holdSpin() {
    if (!this.canHoldSpin) return

    this.isSpinHeld = true
  }

  @action releaseSpin() {
    this.isSpinHeld = false
  }

  @action openSettings() {
    if (!this.canOpenSettings) return

    this.isSettingsOpen = true
  }

  @action closeSettings() {
    this.isSettingsOpen = false
  }
}
