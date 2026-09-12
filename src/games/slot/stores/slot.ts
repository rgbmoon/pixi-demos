import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'
import { readStoredFlag, writeStoredFlag } from 'src/core/storage'
import type {
  CascadeStep,
  GameInitResult,
  HoldWin,
  HoldWinStep,
  Payline,
  RespinStep,
  RoundTransformation,
  SpinResult,
} from 'src/games/slot/api/slot'
import { DEFAULT_GAME_MODE, INITIAL_PHASE, SOUND_STORAGE_KEY } from 'src/games/slot/constants'
import { type CoinValue, ForcedMechanic, PhaseName, StepDirection, type SymbolKey } from 'src/games/slot/types'

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
  /** Настройка игрока: механика, о которой каждый спин просит сервер; `null` — раунд без заказа. */
  @observable forcedMechanic: ForcedMechanic | null = null
  /** Ввод игрока: кнопка спина зажата дольше порога удержания. Пишет кнопка, отпускание принимается в любой фазе. */
  @observable isSpinHeld = false
  /** Идёт турбо-серия: выигрыши копятся в `win` и уходят в кредит по её закрытию. Пишет автомат. */
  @observable isTurboSeries = false
  @observable isSettingsOpen = false
  @observable betIndex = 0
  @observable gameMode: string = DEFAULT_GAME_MODE
  @observable credit = 0
  @observable win = 0
  /** Шаг раунда: 0 — базовый спин, n — n-й респин из ответа сервера. Пишет автомат. */
  @observable roundStep = 0
  /** Шаг каскада: 0 — кадр базового спина, n — n-й шаг каскада из ответа сервера. Пишет автомат. */
  @observable cascadeStep = 0
  /** Шаг бонуса Hold & Win: null — бонус не начат, 0 — стартовое поле, n — вставший n-й шаг из ответа. Пишет автомат. */
  @observable holdWinStep: number | null = null
  /** Монеты бонуса собраны: результат раунда показывает выигрыш бонуса. Пишет автомат. */
  @observable isHoldWinCollected = false

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

  /**
   * Барабаны в движении: фазы `spinning`, `respin` и `holdWinSpin` длятся от старта прокрутки до посадки,
   * `cascade` — от взрыва до конца падения.
   */
  @computed get isSpinning(): boolean {
    return (
      this.phase === PhaseName.spinning ||
      this.phase === PhaseName.respin ||
      this.phase === PhaseName.holdWinSpin ||
      this.phase === PhaseName.cascade
    )
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

  /** Барабаны спина, которые сервер отправил в anticipation. */
  @computed get spinAnticipation(): number[] {
    return this.spinTransformations.find((transformation) => transformation.type === 'anticipation')?.value ?? []
  }

  /** Барабаны, которые садятся с паузой anticipation: турбо паузы пропускает. */
  @computed get presentedAnticipation(): number[] {
    return this.isTurboEnabled ? [] : this.spinAnticipation
  }

  /** Выигрыш базового спина, в котором была пауза anticipation: его показ отличается от обычного. */
  @computed get isAnticipationWin(): boolean {
    return !this.currentRespin && !this.currentCascade && this.spinWin > 0 && this.presentedAnticipation.length > 0
  }

  /** Шаги респина из ответа сервера по порядку. */
  @computed get spinRespins(): RespinStep[] {
    return this.spinTransformations.find((transformation) => transformation.type === 'respins')?.value ?? []
  }

  /** Респин, который показывают барабаны; на базовом спине его нет. */
  @computed get currentRespin(): RespinStep | undefined {
    return this.roundStep > 0 ? this.spinRespins[this.roundStep - 1] : undefined
  }

  /** Следующий шаг респина раунда, если сервер его прислал. */
  @computed get nextRespin(): RespinStep | undefined {
    return this.spinRespins[this.roundStep]
  }

  /** Шаги каскада из ответа сервера по порядку. */
  @computed get spinCascades(): CascadeStep[] {
    return this.spinTransformations.find((transformation) => transformation.type === 'cascades')?.value ?? []
  }

  /** Шаг каскада, который показывают барабаны; на кадре базового спина его нет. */
  @computed get currentCascade(): CascadeStep | undefined {
    return this.cascadeStep > 0 ? this.spinCascades[this.cascadeStep - 1] : undefined
  }

  /** Следующий шаг каскада раунда, если сервер его прислал. */
  @computed get nextCascade(): CascadeStep | undefined {
    return this.spinCascades[this.cascadeStep]
  }

  /** Множитель шага каскада на поле; вне каскада и по закрытии раунда его нет. */
  @computed get cascadeMultiplier(): number | null {
    return this.isIdle ? null : (this.currentCascade?.multiplier ?? null)
  }

  // Каскады идут сразу за базовым спином, респины — после них: поэтому шаг респина в приоритете
  /** Сетка текущего шага раунда: кадр респина, каскада или базового спина. */
  @computed get stepSymbols(): SymbolKey[][] | undefined {
    return this.currentRespin?.frame ?? this.currentCascade?.frame ?? this.spinSymbols
  }

  /** Линии текущего шага раунда; у собранного бонуса линий нет. */
  @computed get stepPaylines(): Payline[] {
    if (this.isHoldWinCollected) return []

    return this.currentRespin?.paylines ?? this.currentCascade?.paylines ?? this.spinPaylines
  }

  /** Выигрыш текущего шага раунда: собранного бонуса, респина, каскада или базового спина. */
  @computed get stepWin(): number {
    if (this.isHoldWinCollected) return this.spinHoldWin?.win ?? 0

    return this.currentRespin?.win ?? this.currentCascade?.win ?? this.spinWin
  }

  /** Бонус Hold & Win из ответа сервера. */
  @computed get spinHoldWin(): HoldWin | undefined {
    return this.spinTransformations.find((transformation) => transformation.type === 'holdAndWin')?.value
  }

  /** Бонус идёт: начат и монеты ещё не собраны. */
  @computed get isHoldWinActive(): boolean {
    return this.holdWinStep !== null && !this.isHoldWinCollected
  }

  /** Бонус есть в ответе, ещё не начат, и шагов каскада и респина перед ним не осталось. */
  @computed get hasPendingHoldWin(): boolean {
    return this.spinHoldWin !== undefined && this.holdWinStep === null && !this.nextCascade && !this.nextRespin
  }

  /** Вставший шаг бонуса; на стартовом поле его нет. */
  @computed get currentHoldWinStep(): HoldWinStep | undefined {
    return this.holdWinStep ? this.spinHoldWin?.steps[this.holdWinStep - 1] : undefined
  }

  /** Следующий шаг бонуса, если бонус идёт и сервер его прислал. */
  @computed get nextHoldWinStep(): HoldWinStep | undefined {
    return this.holdWinStep === null ? undefined : this.spinHoldWin?.steps[this.holdWinStep]
  }

  /** Поле бонуса на текущем шаге: кадр вставшего шага или стартовое. */
  @computed get holdWinFrame(): CoinValue[][] | undefined {
    return this.currentHoldWinStep?.frame ?? this.spinHoldWin?.frame
  }

  /** Счётчик респинов бонуса: меняется, когда шаг встал. */
  @computed get holdWinRespinsLeft(): number {
    return this.currentHoldWinStep?.respinsLeft ?? this.spinHoldWin?.respins ?? 0
  }

  /** Барабаны, удержанные на текущем респине; по закрытии раунда список пуст. */
  @computed get heldReels(): number[] {
    return this.isIdle ? [] : (this.currentRespin?.held ?? [])
  }

  /** Можно ли выбрать механику: только в idle; турбо пропускает паузы, поэтому anticipation при нём недоступен. */
  canToggleForcedMechanic(mechanic: ForcedMechanic): boolean {
    return this.isIdle && !(mechanic === ForcedMechanic.anticipation && this.isTurboEnabled)
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
    this.roundStep = 0
    this.cascadeStep = 0
    this.holdWinStep = null
    this.isHoldWinCollected = false
  }

  /** Переводит раунд на следующий шаг респина. */
  @action advanceRoundStep() {
    this.roundStep += 1
  }

  /** Переводит раунд на следующий шаг каскада. */
  @action advanceCascadeStep() {
    this.cascadeStep += 1
  }

  /** Начинает бонус Hold & Win со стартового поля. */
  @action startHoldWin() {
    this.holdWinStep = 0
  }

  /** Отмечает, что следующий шаг бонуса встал. */
  @action advanceHoldWinStep() {
    this.holdWinStep = (this.holdWinStep ?? 0) + 1
  }

  /** Закрывает бонус: его выигрыш становится выигрышем шага раунда. */
  @action collectHoldWin() {
    this.isHoldWinCollected = true
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

    // Турбо пропускает паузы anticipation: заказ, который нечем показать, снимается
    if (this.isTurboEnabled && this.forcedMechanic === ForcedMechanic.anticipation) {
      this.forcedMechanic = null
    }
  }

  /** Выбирает механику, снимая прежнюю; повторный выбор той же механики снимает заказ. */
  @action toggleForcedMechanic(mechanic: ForcedMechanic) {
    if (!this.canToggleForcedMechanic(mechanic)) return

    this.forcedMechanic = this.forcedMechanic === mechanic ? null : mechanic
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
