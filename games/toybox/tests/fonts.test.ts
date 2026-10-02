// @vitest-environment jsdom
import { type BitmapFont, Cache } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { FONT_FAMILIES } from '#src/assets'
import {
  RESET_CANCEL_ICON,
  RESET_CONFIRM_ICON,
  RESET_CONFIRM_TEXT,
  TOY_SPEECH_LINES,
  TOY_SYMBOL_CHARS,
} from '#src/constants'

/** Символы текста, которых нет в шрифте: BitmapText пропускает их молча. */
const getMissing = (family: string, text: string): string[] => {
  const { chars } = Cache.get<BitmapFont>(`${family}-bitmap`)

  return [...new Set(text)].filter((char) => !(char in chars))
}

describe('пиксельные шрифты', () => {
  it('содержат каждый символ текстов табло, реплик и диалога сброса', () => {
    expect(getMissing(FONT_FAMILIES.marquee, 'WELCOME RESET TOYS 0123456789')).toEqual([])
    expect(
      getMissing(
        FONT_FAMILIES.dialog,
        [...TOY_SPEECH_LINES, TOY_SYMBOL_CHARS, '!', RESET_CONFIRM_TEXT, RESET_CONFIRM_ICON, RESET_CANCEL_ICON].join('')
      )
    ).toEqual([])
  })
})
