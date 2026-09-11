import { LEVEL_TIME_CONSTANT, STOP_MARGIN_S } from './constants'
import type { LoopRecipe } from './types'
import { createFilter, createSource } from './utils'

/**
 * Непрерывный голос синтезатора: источник, фильтр, тремоло и уровень с плавными переходами.
 * Создаётся синтезатором и звучит до `stop`.
 */
export class SynthLoop {
  private readonly context: AudioContext
  private readonly recipe: LoopRecipe
  private readonly output: GainNode
  private readonly sources: Array<OscillatorNode | AudioBufferSourceNode> = []
  private stopped = false

  constructor(context: AudioContext, destination: AudioNode, recipe: LoopRecipe, noise: AudioBuffer) {
    this.context = context
    this.recipe = recipe

    const now = context.currentTime
    const source = createSource(context, recipe.wave, noise, recipe.frequency)
    const body = context.createGain()

    this.output = context.createGain()
    this.output.gain.setValueAtTime(0, now)
    this.output.gain.linearRampToValueAtTime(recipe.gain, now + recipe.fadeIn)

    const head = recipe.filter ? source.connect(createFilter(context, recipe.filter)) : source

    head.connect(body).connect(this.output).connect(destination)
    this.sources.push(source)

    // Тремоло качает громкость между (1 - depth) и 1: база в середине, LFO добавляет ±depth/2
    if (recipe.tremolo) {
      const lfo = context.createOscillator()
      const depth = context.createGain()

      body.gain.value = 1 - recipe.tremolo.depth / 2
      lfo.frequency.value = recipe.tremolo.rate
      depth.gain.value = recipe.tremolo.depth / 2

      lfo.connect(depth).connect(body.gain)
      this.sources.push(lfo)
    }

    for (const node of this.sources) {
      node.start(now)
    }
  }

  get isStopped(): boolean {
    return this.stopped
  }

  /** Плавно выводит петлю на долю `level` от полной громкости. */
  setLevel(level: number): void {
    if (this.stopped) return

    this.output.gain.setTargetAtTime(this.recipe.gain * level, this.context.currentTime, LEVEL_TIME_CONSTANT)
  }

  /** Гасит петлю за `fadeOut` и останавливает источники. Идемпотентен. */
  stop(): void {
    if (this.stopped) return

    this.stopped = true

    const now = this.context.currentTime
    const { gain } = this.output

    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + this.recipe.fadeOut)

    for (const node of this.sources) {
      node.stop(now + this.recipe.fadeOut + STOP_MARGIN_S)
    }

    this.sources[0].onended = () => this.output.disconnect()
  }
}
