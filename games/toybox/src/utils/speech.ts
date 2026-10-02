import {
  TOY_SPEECH_LINES,
  TOY_SYMBOL_CHARS,
  TOY_SYMBOL_MAX_BANGS,
  TOY_SYMBOL_MAX_LENGTH,
  TOY_SYMBOL_MIN_LENGTH,
} from '#src/constants'
import type { Random } from '@pixi-demos/core/types'

/** Выбирает реплику приза: строку списка или, с той же долей, случайные значки с восклицательными знаками. */
export const pickToySpeech = (random: Random): string => {
  const index = Math.floor(random() * (TOY_SPEECH_LINES.length + 1))

  if (index < TOY_SPEECH_LINES.length) return TOY_SPEECH_LINES[index]

  const length = TOY_SYMBOL_MIN_LENGTH + Math.floor(random() * (TOY_SYMBOL_MAX_LENGTH - TOY_SYMBOL_MIN_LENGTH + 1))
  const symbols = Array.from({ length }, () => TOY_SYMBOL_CHARS[Math.floor(random() * TOY_SYMBOL_CHARS.length)])

  return symbols.join('') + '!'.repeat(1 + Math.floor(random() * TOY_SYMBOL_MAX_BANGS))
}
