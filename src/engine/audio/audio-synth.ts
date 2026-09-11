import { inject, injectable } from 'inversify'
import { traceError } from 'src/core/errors/utils'
import { ENGINE_TOKENS } from 'src/engine/tokens'

import { MUTE_TIME_CONSTANT, NOISE_BUFFER_S, STOP_MARGIN_S } from './constants'
import { SynthLoop } from './synth-loop'
import type { AudioConfig, LoopRecipe, PlayOptions, SoundRecipe, SynthVoice } from './types'
import { createFilter, createNoiseBuffer, createSource, scheduleEnvelope } from './utils'

/** Живой контекст: узел общей громкости и буфер шума для голосов. */
type Output = {
  readonly context: AudioContext
  readonly master: GainNode
  readonly noise: AudioBuffer
}

/**
 * Синтезатор звуков на Web Audio API: собирает голоса рецептов из осцилляторов, шума и фильтров.
 * Контекст создаётся на первом звуке, в скрытой вкладке засыпает. Без Web Audio — no-op.
 */
@injectable()
export class AudioSynth {
  private readonly config: AudioConfig
  private readonly lastPlayed = new Map<SoundRecipe, number>()
  private readonly loops = new Set<SynthLoop>()
  private output: Output | null = null
  private muted = false
  /** Контекст играл, когда вкладку скрыли: при возврате его нужно разбудить. */
  private isSuspendedByVisibility = false
  private destroyed = false

  constructor(@inject(ENGINE_TOKENS.AudioConfig) config: AudioConfig) {
    this.config = config
  }

  /** Играет короткий звук. При выключенном звуке и внутри `cooldown` рецепта ничего не делает. */
  play(recipe: SoundRecipe, options: PlayOptions = {}): void {
    if (this.muted) return

    const now = performance.now() / 1000
    const last = this.lastPlayed.get(recipe)

    if (recipe.cooldown !== undefined && last !== undefined && now - last < recipe.cooldown) return

    const output = this.ensureOutput()

    if (!output) return

    this.lastPlayed.set(recipe, now)

    for (const voice of recipe.voices) {
      this.playVoice(output, voice, options)
    }
  }

  /** Запускает петлю. Она звучит и при выключенном звуке: включение посреди петли сразу её слышно. */
  startLoop(recipe: LoopRecipe): SynthLoop | undefined {
    const output = this.ensureOutput()

    if (!output) return undefined

    for (const loop of this.loops) {
      if (loop.isStopped) this.loops.delete(loop)
    }

    const loop = new SynthLoop(output.context, output.master, recipe, output.noise)

    this.loops.add(loop)

    return loop
  }

  /** Плавно гасит или возвращает общую громкость. */
  setMuted(muted: boolean): void {
    this.muted = muted

    if (!this.output) return

    const { context, master } = this.output

    master.gain.setTargetAtTime(muted ? 0 : this.config.masterGain, context.currentTime, MUTE_TIME_CONSTANT)
  }

  /** Останавливает петли и закрывает контекст. Синхронный и идемпотентный. */
  destroy(): void {
    if (this.destroyed) return

    this.destroyed = true

    for (const loop of this.loops) {
      loop.stop()
    }

    this.loops.clear()

    if (!this.output) return

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    void this.switchState('close')
  }

  private playVoice({ context, master, noise }: Output, voice: SynthVoice, options: PlayOptions): void {
    const { pitch = 1, gain = 1 } = options
    const start = context.currentTime + (voice.delay ?? 0)
    const end = start + voice.duration
    const source = createSource(context, voice.wave, noise, (voice.frequency ?? 0) * pitch)
    const envelope = context.createGain()

    if (source instanceof OscillatorNode && voice.frequencyEnd !== undefined) {
      source.frequency.setValueAtTime((voice.frequency ?? 0) * pitch, start)
      source.frequency.exponentialRampToValueAtTime(voice.frequencyEnd * pitch, end)
    }

    scheduleEnvelope(envelope.gain, start, voice.attack, voice.duration, voice.gain * gain)

    const head = voice.filter ? source.connect(createFilter(context, voice.filter, pitch)) : source

    head.connect(envelope).connect(master)

    source.onended = () => envelope.disconnect()

    // Шум стартует со случайного места буфера, чтобы соседние голоса не звучали одинаково
    if (source instanceof AudioBufferSourceNode) {
      source.start(start, Math.random() * NOISE_BUFFER_S)
    } else {
      source.start(start)
    }

    source.stop(end + STOP_MARGIN_S)
  }

  /** Цепочка вывода; создаётся на первом звуке, будит уснувший контекст. */
  private ensureOutput(): Output | null {
    if (this.destroyed || typeof AudioContext === 'undefined') return null

    if (this.output) {
      // suspended — контекст создан до жеста игрока, interrupted — iOS после звонка или смены приложения
      if (this.output.context.state !== 'running' && !document.hidden) void this.switchState('resume')

      return this.output
    }

    const context = new AudioContext()
    const master = context.createGain()

    master.gain.value = this.muted ? 0 : this.config.masterGain
    master.connect(context.destination)

    this.output = { context, master, noise: createNoiseBuffer(context) }

    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    if (context.state !== 'running') void this.switchState('resume')

    return this.output
  }

  private handleVisibilityChange = (): void => {
    if (!this.output) return

    if (document.hidden) {
      this.isSuspendedByVisibility = this.output.context.state === 'running'

      if (this.isSuspendedByVisibility) void this.switchState('suspend')

      return
    }

    if (!this.isSuspendedByVisibility) return

    this.isSuspendedByVisibility = false
    void this.switchState('resume')
  }

  private async switchState(operation: 'resume' | 'suspend' | 'close'): Promise<void> {
    try {
      await this.output?.context[operation]()
    } catch (error) {
      traceError?.(error, `AudioContext ${operation} failed`)
    }
  }
}
