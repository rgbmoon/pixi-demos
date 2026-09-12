import type { LoopRecipe, SoundRecipe, SynthVoice, SynthVoiceTemplate } from 'src/engine/audio/types'
import { createArpeggio } from 'src/engine/audio/utils'
import { SHAKE_MS, SHAKE_OSCILLATIONS } from 'src/games/slot/constants'

// Частоты нот, Гц
const G4 = 392
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98
const B5 = 987.77
const D7 = 2349.32

/** Отношение частоты металлического обертона монеты к основной: негармоническое, как у колокольчика. */
const COIN_OVERTONE_RATIO = 2.76

// Громкости голосов — относительно SOUND_MASTER_GAIN: пики звуков от −30 до −18 dBFS, гул вращения тише
const CHIME_VOICE: SynthVoiceTemplate = {
  wave: 'sine',
  attack: 0.005,
  duration: 0.3,
  gain: 0.15,
}

const CHIME_OVERTONE: SynthVoiceTemplate = {
  wave: 'triangle',
  attack: 0.005,
  duration: 0.2,
  gain: 0.045,
  filter: { type: 'lowpass', frequency: 2500 },
}

const MODAL_VOICE: SynthVoiceTemplate = {
  wave: 'sine',
  attack: 0.005,
  duration: 0.16,
  gain: 0.1,
  filter: { type: 'lowpass', frequency: 2000 },
}

const SHAKE_S = SHAKE_MS / 1000
const SHAKE_PERIOD_S = SHAKE_S / SHAKE_OSCILLATIONS

// Монета звенит на пике каждого колебания тряски кредита (четверть периода), громкость затухает как размах
const COIN_TICKS: SynthVoice[] = Array.from({ length: SHAKE_OSCILLATIONS }, (_, index) => {
  const delay = SHAKE_PERIOD_S * (index + 0.25)
  const gain = 0.06 * (1 - delay / SHAKE_S)

  return [
    { wave: 'sine', frequency: D7, attack: 0.001, duration: 0.06, gain, delay },
    { wave: 'sine', frequency: D7 * COIN_OVERTONE_RATIO, attack: 0.001, duration: 0.04, gain: gain / 3, delay },
  ] satisfies SynthVoice[]
}).flat()

// Мелодия выигрыша после anticipation: быстрый подъём и две долгие ноты наверху; [нота, старт, длина] в секундах
const ANTICIPATION_WIN_MELODY = [
  [G5, 0, 0.12],
  [C6, 0.09, 0.12],
  [E6, 0.18, 0.12],
  [G6, 0.3, 0.3],
  [E6, 0.45, 0.15],
  [G6, 0.6, 0.5],
] as const

const ANTICIPATION_WIN_VOICES: SynthVoice[] = ANTICIPATION_WIN_MELODY.flatMap(([frequency, delay, duration]) => [
  { ...CHIME_VOICE, frequency, delay, duration },
  { ...CHIME_OVERTONE, frequency, delay, duration },
])

/** Короткие звуки слота: рецепты синтезатора по моментам игры. */
export const SLOT_SOUNDS = {
  /** Тап кнопки или чекбокса. */
  click: {
    cooldown: 0.03,
    voices: [
      {
        wave: 'triangle',
        frequency: 1400,
        frequencyEnd: 900,
        attack: 0.002,
        duration: 0.035,
        gain: 0.085,
        filter: { type: 'lowpass', frequency: 3000 },
      },
    ],
  },
  /** Старт вращения. */
  spinStart: {
    voices: [
      { wave: 'sine', frequency: 180, frequencyEnd: 360, attack: 0.01, duration: 0.14, gain: 0.12 },
      {
        wave: 'noise',
        attack: 0.01,
        duration: 0.12,
        gain: 0.045,
        filter: { type: 'bandpass', frequency: 1200, q: 0.8 },
      },
    ],
  },
  /** Старт вращения в турбо: звучит на каждом спине серии, поэтому короче и тише. */
  turboSpinStart: {
    voices: [
      { wave: 'sine', frequency: 220, frequencyEnd: 400, attack: 0.005, duration: 0.07, gain: 0.06 },
      {
        wave: 'noise',
        attack: 0.005,
        duration: 0.06,
        gain: 0.025,
        filter: { type: 'bandpass', frequency: 1400, q: 0.8 },
      },
    ],
  },
  /** Старт респина: два восходящих тона над коротким шумом, отличают его от старта платного спина. */
  respinStart: {
    voices: [
      { ...CHIME_VOICE, frequency: E5, duration: 0.12, gain: 0.1 },
      { ...CHIME_VOICE, frequency: B5, duration: 0.18, gain: 0.1, delay: 0.08 },
      {
        wave: 'noise',
        attack: 0.01,
        duration: 0.1,
        gain: 0.03,
        filter: { type: 'bandpass', frequency: 1400, q: 0.8 },
      },
    ],
  },
  /**
   * Удар посадки барабана: низкое тело для наушников, треугольник и щелчок шума для динамика
   * телефона. Одновременная посадка (slam, турбо) схлопывается `cooldown` в один удар.
   */
  reelStop: {
    cooldown: 0.06,
    voices: [
      { wave: 'sine', frequency: 150, frequencyEnd: 70, attack: 0.003, duration: 0.11, gain: 0.12 },
      { wave: 'triangle', frequency: 380, frequencyEnd: 220, attack: 0.002, duration: 0.06, gain: 0.05 },
      {
        wave: 'noise',
        attack: 0.001,
        duration: 0.025,
        gain: 0.03,
        filter: { type: 'lowpass', frequency: 1800 },
      },
    ],
  },
  /** Выигрыш: мажорное трезвучие вверх. */
  winSmall: {
    voices: [...createArpeggio([C5, E5, G5], 0.08, CHIME_VOICE), ...createArpeggio([C5, E5, G5], 0.08, CHIME_OVERTONE)],
  },
  /** Крупный выигрыш: арпеджио на две октавы и тихое мерцание октавой выше. */
  winBig: {
    voices: [
      ...createArpeggio([C5, E5, G5, C6, E6], 0.07, { ...CHIME_VOICE, duration: 0.4 }),
      ...createArpeggio([C5, E5, G5, C6, E6], 0.07, CHIME_OVERTONE),
      ...createArpeggio([C6, E6, G5 * 2, C6 * 2, E6 * 2], 0.07, { ...CHIME_VOICE, duration: 0.5, gain: 0.03 }),
    ],
  },
  /** Выигрыш после anticipation: мелодия под вспышки фона, отличает его от обычного выигрыша. */
  anticipationWin: {
    voices: ANTICIPATION_WIN_VOICES,
  },
  /** Выигрыш в турбо: одна короткая пара нот под вспышку линий. */
  turboWin: {
    voices: [
      { ...CHIME_VOICE, frequency: G5, duration: 0.15, gain: 0.1 },
      { ...CHIME_VOICE, frequency: C6, duration: 0.15, gain: 0.08 },
    ],
  },
  /** Зачисление на счёт: звон кассы и монеты в такт тряске строки кредита. */
  creditTopUp: {
    voices: [
      { ...CHIME_VOICE, frequency: B5, duration: 0.3, gain: 0.08 },
      { ...CHIME_VOICE, frequency: E6, duration: 0.35, gain: 0.08, delay: 0.06 },
      ...COIN_TICKS,
    ],
  },
  /** Спин зажат: турбо-серия пошла. */
  turboEngage: {
    voices: [
      {
        wave: 'sine',
        frequency: 300,
        frequencyEnd: 900,
        attack: 0.02,
        duration: 0.25,
        gain: 0.11,
        filter: { type: 'lowpass', frequency: 2000 },
      },
    ],
  },
  /** Спин отпущен. */
  turboRelease: {
    voices: [{ wave: 'sine', frequency: 700, frequencyEnd: 350, attack: 0.01, duration: 0.15, gain: 0.07 }],
  },
  modalOpen: {
    voices: createArpeggio([G4, C5], 0.06, MODAL_VOICE),
  },
  modalClose: {
    voices: createArpeggio([C5, G4], 0.06, MODAL_VOICE),
  },
} as const satisfies Record<string, SoundRecipe>

/** Гул вращения барабанов: полосовой шум с тремоло; в турбо полоса и тремоло выше. */
export const SLOT_LOOPS = {
  spin: {
    wave: 'noise',
    gain: 0.1,
    filter: { type: 'bandpass', frequency: 700, q: 1.2 },
    tremolo: { rate: 12, depth: 0.4 },
    fadeIn: 0.08,
    fadeOut: 0.15,
  },
  turboSpin: {
    wave: 'noise',
    gain: 0.1,
    filter: { type: 'bandpass', frequency: 900, q: 1.2 },
    tremolo: { rate: 18, depth: 0.4 },
    fadeIn: 0.05,
    fadeOut: 0.1,
  },
  // Низкая пила под lowpass с глубоким тремоло: пульсирующий гул барабана на паузе anticipation
  anticipation: {
    wave: 'sawtooth',
    frequency: 110,
    gain: 0.07,
    filter: { type: 'lowpass', frequency: 900, q: 4 },
    tremolo: { rate: 6, depth: 0.7 },
    fadeIn: 0.25,
    fadeOut: 0.12,
  },
} as const satisfies Record<string, LoopRecipe>
