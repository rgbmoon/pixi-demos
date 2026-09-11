/** Источник голоса: осциллятор заданной формы или белый шум. */
export type SynthWave = Exclude<OscillatorType, 'custom'> | 'noise'

/** Фильтр голоса; частота масштабируется вместе с высотой звука. */
export type SynthFilter = {
  readonly type: BiquadFilterType
  /** Частота среза или центра полосы, Гц. */
  readonly frequency: number
  readonly q?: number
}

/** Голос звука: источник с огибающей громкости и опциональным фильтром. Времена — в секундах. */
export type SynthVoice = {
  readonly wave: SynthWave
  /** Частота осциллятора, Гц; шуму не нужна. */
  readonly frequency?: number
  /** Частота в конце голоса: экспоненциальное глиссандо от `frequency`. */
  readonly frequencyEnd?: number
  /** Смещение старта от момента `play`. */
  readonly delay?: number
  /** Нарастание громкости до пика. */
  readonly attack: number
  /** Длина голоса вместе с затуханием. */
  readonly duration: number
  /** Пик огибающей. */
  readonly gain: number
  readonly filter?: SynthFilter
}

/** Голос без высоты и сдвига: шаблон, из которого арпеджио собирает ноты. */
export type SynthVoiceTemplate = Omit<SynthVoice, 'frequency' | 'frequencyEnd' | 'delay'>

/** Короткий звук: набор голосов, стартующих от одного момента. */
export type SoundRecipe = {
  readonly voices: readonly SynthVoice[]
  /** Повторный запуск раньше этого интервала в секундах отбрасывается. */
  readonly cooldown?: number
}

/** Параметры запуска звука: множитель высоты и громкости. */
export type PlayOptions = {
  readonly pitch?: number
  readonly gain?: number
}

/** Модуляция громкости петли: частота, Гц, и глубина в долях уровня. */
export type Tremolo = {
  readonly rate: number
  readonly depth: number
}

/** Непрерывный звук: один голос, звучащий до `stop`. Времена — в секундах. */
export type LoopRecipe = {
  readonly wave: SynthWave
  /** Частота осциллятора, Гц; шуму не нужна. */
  readonly frequency?: number
  /** Громкость петли на полном уровне. */
  readonly gain: number
  readonly filter?: SynthFilter
  readonly tremolo?: Tremolo
  readonly fadeIn: number
  readonly fadeOut: number
}

/** Настройки синтезатора от игры. */
export type AudioConfig = {
  /** Общая громкость всех звуков. */
  readonly masterGain: number
}
