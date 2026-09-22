// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { GlassMask } from '#src/ui/box/glass-mask'

describe('GlassMask', () => {
  it('исключена из обычной отрисовки сразу после создания', () => {
    const mask = new GlassMask()

    expect(mask.includeInBuild).toBe(false)
    expect(mask.measurable).toBe(false)

    mask.destroy()
  })
})
