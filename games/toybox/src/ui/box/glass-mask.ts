import { Graphics } from 'pixi.js'

import { getGlassMaskOutline, projectWorldOutline } from '#src/utils/machine-geometry'
import { PALETTE } from '@pixi-demos/core/palette'

/** Невидимая маска спроектированного стеклянного объёма. */
export class GlassMask extends Graphics {
  constructor() {
    super()

    this.poly(projectWorldOutline(getGlassMaskOutline())).fill(PALETTE.white)
    this.includeInBuild = false
    this.measurable = false
  }
}
