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
    this.listen(emitter, 'spin:landed', this.handleSpinLanded)
    this.listen(emitter, 'credit:toppedUp', () => synth.play(SLOT_SOUNDS.creditTopUp))

    // Фаза покидает spinning и при провале запроса, где spin:landed не эмитится
    this.watch(
      () => slotStore.isSpinning,
      (isSpinning) => {
        if (!isSpinning) this.stopSpinLoop()
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

    this.stopSpinLoop()
    this.spinLoop = this.synth.startLoop(isTurboEnabled ? SLOT_LOOPS.turboSpin : SLOT_LOOPS.spin)
    this.landedReels = 0
  }

  /** Удар посадки выше на каждом следующем барабане, гул стихает по мере посадки. */
  private handleReelLanded = ({ reel }: GameEvents['reel:landed']): void => {
    this.synth.play(SLOT_SOUNDS.reelStop, { pitch: 1 + REEL_STOP_PITCH_STEP * reel })

    this.landedReels += 1
    this.spinLoop?.setLevel(1 - this.landedReels / REELS_COUNT)
  }

  /** Выигрыш озвучивается по сумме спина из стора: в турбо коротко, иначе по крупности. */
  private handleSpinLanded = (): void => {
    const { spinWin, bet, isTurboEnabled } = this.slotStore

    if (spinWin <= 0) return

    if (isTurboEnabled) {
      this.synth.play(SLOT_SOUNDS.turboWin)

      return
    }

    this.synth.play(spinWin >= bet * BIG_WIN_MULTIPLIER ? SLOT_SOUNDS.winBig : SLOT_SOUNDS.winSmall)
  }

  private stopSpinLoop(): void {
    this.spinLoop?.stop()
    this.spinLoop = undefined
  }
}
