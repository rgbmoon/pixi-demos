import { MIN_GAIN, NOISE_BUFFER_S } from './constants'
import type { SynthFilter, SynthVoice, SynthVoiceTemplate, SynthWave } from './types'

/** Буфер белого шума длиной `NOISE_BUFFER_S`: общий источник для всех шумовых голосов контекста. */
export const createNoiseBuffer = (context: BaseAudioContext): AudioBuffer => {
  const length = Math.floor(context.sampleRate * NOISE_BUFFER_S)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let i = 0; i < length; i++) {
    samples[i] = Math.random() * 2 - 1
  }

  return buffer
}

/** Источник голоса: осциллятор на частоте `frequency` или зацикленный шум. Не запущен. */
export const createSource = (
  context: BaseAudioContext,
  wave: SynthWave,
  noise: AudioBuffer,
  frequency = 0
): OscillatorNode | AudioBufferSourceNode => {
  if (wave === 'noise') {
    const source = context.createBufferSource()

    source.buffer = noise
    source.loop = true

    return source
  }

  const oscillator = context.createOscillator()

  oscillator.type = wave
  oscillator.frequency.value = frequency

  return oscillator
}

/** Биквадратный фильтр по описанию; частота умножается на `pitch`. */
export const createFilter = (context: BaseAudioContext, filter: SynthFilter, pitch = 1): BiquadFilterNode => {
  const node = context.createBiquadFilter()

  node.type = filter.type
  node.frequency.value = filter.frequency * pitch

  if (filter.q !== undefined) node.Q.value = filter.q

  return node
}

/** Огибающая голоса: линейная атака до `peak` и экспоненциальное затухание к концу `duration`. */
export const scheduleEnvelope = (
  param: AudioParam,
  start: number,
  attack: number,
  duration: number,
  peak: number
): void => {
  param.setValueAtTime(0, start)
  param.linearRampToValueAtTime(peak, start + attack)
  param.exponentialRampToValueAtTime(MIN_GAIN, start + duration)
}

/** Голоса арпеджио: шаблон голоса на каждую ноту со сдвигом `step` секунд. */
export const createArpeggio = (
  frequencies: readonly number[],
  step: number,
  template: SynthVoiceTemplate
): SynthVoice[] => frequencies.map((frequency, index) => ({ ...template, frequency, delay: index * step }))
