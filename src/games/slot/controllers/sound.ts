import { inject, injectable } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'
import type { AudioSynth } from 'src/engine/audio/audio-synth'
import type { SynthLoop } from 'src/engine/audio/synth-loop'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { BIG_WIN_MULTIPLIER, REEL_STOP_PITCH_STEP, REELS_COUNT } from 'src/games/slot/constants'
import type { GameEvents } from 'src/games/slot/events'
import { SLOT_LOOPS, SLOT_SOUNDS } from 'src/games/slot/sounds'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'

/**
 * Звук слота: подписан на события и состояние игры, по ним играет рецепты синтезатора.
 * Ничего не рисует; в дереве сцены только ради владения подписками.
 */
@injectable()
export class SoundController extends LiveContainer {
  private readonly synth: AudioSynth
  private readonly slotStore: SlotStore
  private spinLoop?: SynthLoop
  private anticipationLoop?: SynthLoop
  /** Барабан, чью паузу anticipation озвучивает `anticipationLoop`. */
  private anticipatedReel?: number
  private landedReels = 0

  constructor(
    @inject(ENGINE_TOKENS.AudioSynth) synth: AudioSynth,
    @inject(SLOT_TOKENS.GameEmitter) emitter: GameEmitter<GameEvents>,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore
  ) {
    super()

    this.synth = synth
    this.slotStore = slotStore

    // Первой: сохранённое «выключено» обязано примениться до любого звука
    this.watch(
      () => slotStore.isSoundOn,
      (isOn) => synth.setMuted(!isOn),
      { fireImmediately: true }
    )

    this.listen(emitter, 'ui:buttonTapped', () => synth.play(SLOT_SOUNDS.click))
    this.listen(emitter, 'spin:started', this.handleSpinStarted)
    this.listen(emitter, 'reel:landed', this.handleReelLanded)
    this.listen(emitter, 'reel:anticipationStarted', this.handleAnticipationStarted)
    this.listen(emitter, 'spin:landed', this.handleSpinLanded)
    this.listen(emitter, 'respin:started', this.handleRespinStarted)
    this.listen(emitter, 'respin:landed', this.handleSpinLanded)
    this.listen(emitter, 'credit:toppedUp', () => synth.play(SLOT_SOUNDS.creditTopUp))
    this.listen(emitter, 'holdWin:started', () => synth.play(SLOT_SOUNDS.holdWinStart))
    this.listen(emitter, 'holdWin:spinStarted', this.handleHoldWinSpinStarted)
    this.listen(emitter, 'holdWin:cellLanded', this.handleCellLanded)
    // Фаза шага бонуса идёт подряд, isSpinning между шагами не падает: гул снимает посадка шага
    this.listen(emitter, 'holdWin:landed', () => this.stopSpinLoop())
    this.listen(emitter, 'holdWin:collected', this.handleHoldWinCollected)
    this.listen(emitter, 'cascade:started', () => synth.play(SLOT_SOUNDS.cascadeBurst))
    // Удары падения озвучивает reel:landed, выигрыш нового кадра — как у посадки
    this.listen(emitter, 'cascade:landed', this.handleSpinLanded)

    // Фаза покидает spinning и при провале запроса, где spin:landed не эмитится
    this.watch(
      () => slotStore.isSpinning,
      (isSpinning) => {
        if (isSpinning) return

        this.stopSpinLoop()
        this.stopAnticipationLoop()
      }
    )

    this.watch(
      () => slotStore.isSpinHeld,
      (isHeld) => synth.play(isHeld ? SLOT_SOUNDS.turboEngage : SLOT_SOUNDS.turboRelease)
    )

    this.watch(
      () => slotStore.isSettingsOpen,
      (isOpen) => synth.play(isOpen ? SLOT_SOUNDS.modalOpen : SLOT_SOUNDS.modalClose)
    )
  }

  private handleSpinStarted = (): void => {
    const { isTurboEnabled } = this.slotStore

    this.synth.play(isTurboEnabled ? SLOT_SOUNDS.turboSpinStart : SLOT_SOUNDS.spinStart)

    this.startSpinLoop(0)
  }

  /** Удержанные барабаны не садятся: гул стихает только по крутящимся. */
  private handleRespinStarted = ({ held }: GameEvents['respin:started']): void => {
    this.synth.play(SLOT_SOUNDS.respinStart)

    this.startSpinLoop(held.length)
  }

  private handleHoldWinSpinStarted = (): void => {
    this.synth.play(SLOT_SOUNDS.respinStart)

    this.startSpinLoop(0)
  }

  /** Монета звенит, пустая ячейка садится ударом барабана: одновременные удары схлопывает `cooldown`. */
  private handleCellLanded = ({ value }: GameEvents['holdWin:cellLanded']): void => {
    this.synth.play(value ? SLOT_SOUNDS.coinLand : SLOT_SOUNDS.reelStop)
  }

  /** Полное поле озвучивается мелодией, обычный сбор — крупным выигрышем. */
  private handleHoldWinCollected = ({ grand }: GameEvents['holdWin:collected']): void => {
    this.synth.play(grand > 0 ? SLOT_SOUNDS.anticipationWin : SLOT_SOUNDS.winBig)
  }

  /** Запускает гул вращения с уровнем по числу уже стоящих барабанов. */
  private startSpinLoop(landedReels: number): void {
    this.stopSpinLoop()
    this.spinLoop = this.synth.startLoop(this.slotStore.isTurboEnabled ? SLOT_LOOPS.turboSpin : SLOT_LOOPS.spin)
    this.landedReels = landedReels

    // Без удержанных уровень полный: setLevel перебил бы нарастание fadeIn
    if (landedReels > 0) this.spinLoop?.setLevel(1 - landedReels / REELS_COUNT)
  }

  /** Удар посадки выше на каждом следующем барабане, гул стихает по мере посадки. */
  private handleReelLanded = ({ reel }: GameEvents['reel:landed']): void => {
    this.synth.play(SLOT_SOUNDS.reelStop, { pitch: 1 + REEL_STOP_PITCH_STEP * reel })

    this.landedReels += 1
    this.spinLoop?.setLevel(1 - this.landedReels / REELS_COUNT)

    if (reel === this.anticipatedReel) this.stopAnticipationLoop()
  }

  /** Гул паузы переходит на следующий ждущий барабан: петля перезапускается, а не наслаивается. */
  private handleAnticipationStarted = ({ reel }: GameEvents['reel:anticipationStarted']): void => {
    this.stopAnticipationLoop()

    this.anticipationLoop = this.synth.startLoop(SLOT_LOOPS.anticipation)
    this.anticipatedReel = reel
  }

  /** Выигрыш озвучивается по сумме шага из стора: в турбо коротко, после anticipation мелодией, иначе по крупности. */
  private handleSpinLanded = (): void => {
    const { stepWin, bet, isTurboEnabled, isAnticipationWin } = this.slotStore

    if (stepWin <= 0) return

    if (isTurboEnabled) {
      this.synth.play(SLOT_SOUNDS.turboWin)

      return
    }

    if (isAnticipationWin) {
      this.synth.play(SLOT_SOUNDS.anticipationWin)

      return
    }

    this.synth.play(stepWin >= bet * BIG_WIN_MULTIPLIER ? SLOT_SOUNDS.winBig : SLOT_SOUNDS.winSmall)
  }

  private stopSpinLoop(): void {
    this.spinLoop?.stop()
    this.spinLoop = undefined
  }

  private stopAnticipationLoop(): void {
    this.anticipationLoop?.stop()
    this.anticipationLoop = undefined
    this.anticipatedReel = undefined
  }
}
